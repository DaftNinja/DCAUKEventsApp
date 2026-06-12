import { Router } from "express";
import { z } from "zod";
import {
  getAllReports, getReportBySlug, createOrUpdateReport,
  updateSalesEnablement, deleteReport, isCacheValid, slugify,
} from "./storage.js";
import { generateReport, generateSalesEnablement, generateInvestorPresentation } from "./claude.js";
import { writeAuditLog } from "./auth.js";

export const router = Router();

// ─── Request helpers ──────────────────────────────────────────────────────────

function getSessionUser(req: any): { id?: number; email?: string } {
  const user = req.session?.user;
  return { id: user?.id ?? undefined, email: user?.email ?? undefined };
}

function getClientIp(req: any): string | undefined {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    ?? req.socket?.remoteAddress;
}

// ─── Reports ──────────────────────────────────────────────────────────────────

router.get("/reports", async (_req, res) => {
  try {
    const all = await getAllReports();
    res.json(all);
  } catch (err) {
    console.error("GET /reports error:", err);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

router.get("/reports/:slug", async (req, res) => {
  try {
    const report = await getReportBySlug(req.params.slug);
    if (!report) return res.status(404).json({ error: "Report not found" });
    res.json(report);
  } catch (err) {
    console.error("GET /reports/:slug error:", err);
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

router.post("/reports/generate", async (req: any, res) => {
  const schema = z.object({
    companyName: z.string().min(1).max(200),
    forceRefresh: z.boolean().optional().default(false),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.message });

  const { companyName, forceRefresh } = parse.data;
  const slug = slugify(companyName);

  try {
    // Check cache first
    if (!forceRefresh) {
      const existing = await getReportBySlug(slug);
      if (existing && (await isCacheValid(existing))) {
        const { id: cacheUserId, email: cacheEmail } = getSessionUser(req);
        await writeAuditLog("REPORT_CACHE_HIT", companyName, cacheUserId, cacheEmail, getClientIp(req));
        return res.json({ report: existing, cached: true });
      }
    }

    // Generate — retry up to 2 times, with backoff for rate limits
    let reportData: unknown;
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        reportData = await generateReport(companyName);
        break;
      } catch (err: any) {
        lastError = err;
        const status = err?.status ?? 0;
        // 429 = rate limited — wait and retry
        if (status === 429) {
          const retryAfter = parseInt(err?.headers?.['retry-after'] ?? '10', 10);
          const waitMs = Math.min((retryAfter + 2) * 1000, 30000);
          console.warn(`Rate limited (429), waiting ${waitMs}ms before retry ${attempt + 1}...`);
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        // Other 4xx errors (except 429) — don't retry
        if (status >= 400 && status < 500) throw err;
        if (attempt === 0) {
          console.warn(`Report generation attempt 1 failed (${status}), retrying…`);
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }
    if (!reportData) throw lastError;

    const industry = (reportData as { industry?: string }).industry ?? "Unknown";
    const saved = await createOrUpdateReport({ companyName, industry, reportData, isGenerating: false });

    const { id: genUserId, email: genEmail } = getSessionUser(req);
    await writeAuditLog("REPORT_GENERATED", companyName, genUserId, genEmail, getClientIp(req));

    res.json({ report: saved, cached: false });
  } catch (err: any) {
    console.error("POST /reports/generate error:", err);
    const status = err?.status ?? 0;
    const message = status === 429
      ? "Service is temporarily busy — please wait a moment and try again."
      : "Report generation failed. Please try again.";
    res.status(500).json({ error: message });
  }
});

router.post("/reports/:slug/sales-enablement", async (req, res) => {
  const schema = z.object({ sellerProduct: z.string().min(1).max(500) });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.message });

  const report = await getReportBySlug(req.params.slug);
  if (!report) return res.status(404).json({ error: "Report not found" });

  try {
    const salesData = await generateSalesEnablement(
      report.companyName,
      report.reportData,
      parse.data.sellerProduct
    );
    const updated = await updateSalesEnablement(req.params.slug, salesData);
    const { id: seUserId, email: seEmail } = getSessionUser(req);
    await writeAuditLog("SALES_ENABLEMENT_GENERATED", report.companyName, seUserId, seEmail, getClientIp(req));
    res.json({ salesEnablement: salesData, report: updated });
  } catch (err) {
    console.error("POST sales-enablement error:", err);
    res.status(500).json({ error: "Sales enablement generation failed" });
  }
});

router.post("/reports/:slug/investor-presentation", async (req, res) => {
  const report = await getReportBySlug(req.params.slug);
  if (!report) return res.status(404).json({ error: "Report not found" });

  try {
    const presentation = await generateInvestorPresentation(report.companyName, report.reportData);
    const { id: invUserId, email: invEmail } = getSessionUser(req);
    await writeAuditLog("INVESTOR_PRESENTATION_GENERATED", report.companyName, invUserId, invEmail, getClientIp(req));
    res.json({ presentation });
  } catch (err) {
    console.error("POST investor-presentation error:", err);
    res.status(500).json({ error: "Presentation generation failed" });
  }
});

router.delete("/reports/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  try {
    await deleteReport(id);
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /reports/:id error:", err);
    res.status(500).json({ error: "Failed to delete report" });
  }
});

// ─── Batch Upload ─────────────────────────────────────────────────────────────

router.post("/reports/batch", async (req, res) => {
  const schema = z.object({ companies: z.array(z.string().min(1)).min(1).max(50) });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.message });

  const { companies } = parse.data;
  const results: { company: string; status: string; slug?: string }[] = [];

  // Process sequentially to avoid rate limits
  for (const company of companies) {
    try {
      const slug = slugify(company);
      const existing = await getReportBySlug(slug);
      if (existing && (await isCacheValid(existing))) {
        const { id: bUserId, email: bEmail } = getSessionUser(req);
        await writeAuditLog("REPORT_CACHE_HIT", company, bUserId, bEmail, getClientIp(req));
        results.push({ company, status: "cached", slug });
        continue;
      }
      const reportData = await generateReport(company);
      const industry = (reportData as { industry?: string }).industry ?? "Unknown";
      await createOrUpdateReport({ companyName: company, industry, reportData });
      const { id: bgUserId, email: bgEmail } = getSessionUser(req);
      await writeAuditLog("REPORT_GENERATED", company, bgUserId, bgEmail, getClientIp(req));
      results.push({ company, status: "generated", slug });
    } catch (err) {
      console.error(`Batch generation failed for ${company}:`, err);
      results.push({ company, status: "failed" });
    }
  }

  res.json({ results });
});