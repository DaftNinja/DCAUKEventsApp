import { Router } from "express";
import { z } from "zod";
import {
  getAllReports, getReportBySlug, createOrUpdateReport,
  updateSalesEnablement, deleteReport, isCacheValid, slugify,
} from "./storage.js";
import { generateReport, generateSalesEnablement, generateInvestorPresentation, resolveCompanyName } from "./claude.js";
import { writeAuditLog, getUserById, decrementCredits, isAdmin } from "./auth.js";
import { sendReportReadyEmail } from "./email.js";

export const router = Router();

// ─── Public listing detection ────────────────────────────────────────────────
// Allowlist approach: a company is considered publicly listed ONLY if its
// stockExchange field contains a recognisable exchange name or ticker prefix.
// Anything else — empty, N/A, Private, "Privately held by the Schwarz family",
// "Not publicly traded", etc. — is treated as private.
export function isPubliclyListed(stockExchange: string | undefined | null): boolean {
  if (!stockExchange || !stockExchange.trim()) return false;
  const s = stockExchange.trim().toUpperCase();
  // Known exchange names and ticker prefixes
  const PUBLIC_PATTERNS = [
    // US
    /\bNYSE\b/, /\bNASDAQ\b/, /\bNYSE\s*ARCA\b/, /\bAMEX\b/, /\bOTCBB\b/, /\bOTC\b/,
    // UK
    /\bLSE\b/, /\bLONDON\s*STOCK\s*EXCHANGE\b/, /\bAIM\b/,
    // Europe
    /\bEURONEXT\b/, /\bXETRA\b/, /\bFSE\b/, /\bFRANKFURT\b/,
    /\bSIX\b/, /\bSWX\b/, /\bOMX\b/, /\bHELSINKI\b/,
    /\bBME\b/, /\bBORSA\s*ITALIANA\b/, /\bENXT\b/,
    // Asia-Pacific
    /\bTSE\b/, /\bTOKYO\b/, /\bTYO\b/, /\bHKEX\b/, /\bHKG\b/,
    /\bASX\b/, /\bSGX\b/, /\bBSE\b/, /\bNSE\b/,
    // Canada / Other
    /\bTSX\b/, /\bTSX-V\b/, /\bJSE\b/, /\bB3\b/,
    // Ticker colon patterns e.g. "LSE: TSCO", "NASDAQ: AAPL", "NYSE: IBM"
    /[A-Z]{2,6}:\s*[A-Z]{1,6}/,
  ];
  return PUBLIC_PATTERNS.some(p => p.test(s));
}

function getSessionUser(req: any): { id?: number; email?: string } {
  // Session stores userId and email directly on req.session (set in authRoutes.ts)
  return {
    id: req.session?.userId ?? undefined,
    email: req.session?.email ?? undefined,
  };
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

// ─── SSE helper ───────────────────────────────────────────────────────────────────
function sseEmit(res: any, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

router.post("/reports/generate", async (req: any, res) => {
  const schema = z.object({
    companyName: z.string().min(1).max(200),
    forceRefresh: z.boolean().optional().default(false),
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.message });

  const { companyName: rawInput, forceRefresh } = parse.data;
  const companyName = await resolveCompanyName(rawInput);
  console.log(`⏱️  generate: "${rawInput}" → "${companyName}"`);
  const slug = slugify(companyName);
  const { id: userId, email: userEmail } = getSessionUser(req);

  // ── Set up SSE ──────────────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering on Railway
  res.flushHeaders();

  const emit = (event: string, data: unknown) => sseEmit(res, event, data);

  try {
    // Cache hit — instant
    if (!forceRefresh) {
      const existing = await getReportBySlug(slug);
      if (existing && (await isCacheValid(existing))) {
        await writeAuditLog("REPORT_CACHE_HIT", companyName, userId, userEmail, getClientIp(req));
        emit("done", { report: existing, cached: true });
        return res.end();
      }
    }

    // Credit check
    if (userId) {
      const user = await getUserById(userId);
      if (user && !isAdmin(user.email) && user.reportCredits <= 0) {
        await writeAuditLog("REPORT_BLOCKED_NO_CREDITS", companyName, userId, userEmail, getClientIp(req));
        emit("error", { error: "You've used all your report credits. Contact us to get more.", code: "NO_CREDITS" });
        return res.end();
      }
    }

    // ── Streaming generation ──────────────────────────────────────────
    emit("progress", { stage: "starting", message: "Resolving company information…" });

    const genStart = Date.now();
    let reportData: unknown;
    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // generateReport now accepts an onProgress callback to emit SSE events
        reportData = await generateReport(companyName, undefined, undefined, (stage: string, message: string) => {
          emit("progress", { stage, message });
        });
        break;
      } catch (err: any) {
        lastError = err;
        const status = err?.status ?? 0;
        if (status === 429) {
          const waitMs = Math.min((parseInt(err?.headers?.['retry-after'] ?? '10', 10) + 2) * 1000, 30000);
          emit("progress", { stage: "waiting", message: "Service busy — retrying shortly…" });
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        if (status >= 400 && status < 500) throw err;
        if (attempt === 0) {
          emit("progress", { stage: "retrying", message: "Retrying…" });
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }
    if (!reportData) throw lastError;

    const elapsed = Math.round((Date.now() - genStart) / 1000);
    console.log(`⏱️  generateReport done in ${elapsed}s`);

    const industry = (reportData as { industry?: string }).industry ?? "Unknown";
    const saved = await createOrUpdateReport({ companyName, industry, reportData, isGenerating: false });

    // Decrement credit
    let userForEmail: Awaited<ReturnType<typeof getUserById>> = null;
    if (userId) {
      userForEmail = await getUserById(userId);
      if (userForEmail && !isAdmin(userForEmail.email)) {
        await decrementCredits(userId);
      }
    }

    await writeAuditLog("REPORT_GENERATED", companyName, userId, userEmail, getClientIp(req));

    // Emit done — frontend navigates immediately
    emit("done", { report: saved, cached: false });
    res.end();

    // Send email after response is closed (non-blocking)
    // Skip on forceRefresh — user is already looking at the report
    if (!forceRefresh && userForEmail && userEmail) {
      sendReportReadyEmail(
        userEmail,
        userForEmail.firstName,
        companyName,
        saved.companySlug,
        elapsed
      ).catch(err => console.warn("Report ready email failed:", err));
    }

  } catch (err: any) {
    console.error("POST /reports/generate error:", err);
    const status = err?.status ?? 0;
    const message = status === 429
      ? "Service is temporarily busy — please wait a moment and try again."
      : "Report generation failed. Please try again.";
    emit("error", { error: message });
    res.end();
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

  // Block investor presentations for private companies.
  // Uses allowlist detection — must match a real exchange name or ticker pattern.
  const reportData = report.reportData as any;
  const stockExchange: string = reportData?.executiveSummary?.stockExchange ?? "";

  if (!isPubliclyListed(stockExchange)) {
    const { id: invUserId, email: invEmail } = getSessionUser(req);
    await writeAuditLog(
      "INVESTOR_PRESENTATION_BLOCKED_PRIVATE",
      report.companyName,
      invUserId,
      invEmail,
      getClientIp(req)
    );
    return res.status(403).json({
      error: "Investor presentations can only be generated for publicly listed companies.",
      code: "PRIVATE_COMPANY",
    });
  }

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
  const { id: userId, email: userEmail } = getSessionUser(req);
  const results: { company: string; status: string; slug?: string; error?: string }[] = [];

  // ── Credit check upfront — count non-cached companies and verify sufficient credits
  if (userId) {
    const user = await getUserById(userId);
    if (user && !isAdmin(user.email)) {
      let creditsNeeded = 0;
      for (const company of companies) {
        const existing = await getReportBySlug(slugify(company));
        if (!existing || !(await isCacheValid(existing))) creditsNeeded++;
      }
      if (creditsNeeded > user.reportCredits) {
        return res.status(403).json({
          error: `This batch requires ${creditsNeeded} credits but you only have ${user.reportCredits}. Reduce the batch size or contact us for more credits.`,
          code: "NO_CREDITS",
          creditsNeeded,
          creditsAvailable: user.reportCredits,
        });
      }
    }
  }

  // ── Process in chunks of 2 — parallel within each chunk, sequential across chunks
  const CHUNK_SIZE = 2;

  const processCompany = async (company: string): Promise<void> => {
    try {
      const slug = slugify(company);
      const existing = await getReportBySlug(slug);
      if (existing && (await isCacheValid(existing))) {
        await writeAuditLog("REPORT_CACHE_HIT", company, userId, userEmail, getClientIp(req));
        results.push({ company, status: "cached", slug });
        return;
      }
      const reportData = await generateReport(company);
      const industry = (reportData as { industry?: string }).industry ?? "Unknown";
      await createOrUpdateReport({ companyName: company, industry, reportData });
      if (userId) {
        const user = await getUserById(userId);
        if (user && !isAdmin(user.email)) await decrementCredits(userId);
      }
      await writeAuditLog("REPORT_GENERATED", company, userId, userEmail, getClientIp(req));
      results.push({ company, status: "generated", slug });
    } catch (err: any) {
      console.error(`Batch generation failed for ${company}:`, err);
      results.push({ company, status: "failed", error: err?.message ?? "Unknown error" });
    }
  };

  const batchStart = Date.now();
  console.log(`📦 Batch: ${companies.length} companies, chunk size ${CHUNK_SIZE}`);

  for (let i = 0; i < companies.length; i += CHUNK_SIZE) {
    const chunk = companies.slice(i, i + CHUNK_SIZE);
    console.log(`📦 Chunk ${Math.floor(i / CHUNK_SIZE) + 1}: ${chunk.join(", ")}`);
    await Promise.allSettled(chunk.map(processCompany));
  }

  console.log(`📦 Batch complete in ${((Date.now() - batchStart) / 1000).toFixed(1)}s`);
  res.json({ results });
});