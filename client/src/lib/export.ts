import type { ReportData } from "@shared/schema";
import { formatDate } from "./utils";

export async function exportToPDF(companyName: string): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const { default: html2canvas } = await import("html2canvas");

  const element = document.getElementById("report-content");
  if (!element) return;

  const canvas = await html2canvas(element, {
    scale: 1.5,
    useCORS: true,
    backgroundColor: "#080d14",
    logging: false,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgHeight = (canvas.height * pageWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, pageWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, pageWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(`${companyName.replace(/\s+/g, "_")}_1GL_Report.pdf`);
}

export async function exportToPPTX(report: ReportData): Promise<void> {
  const pptxgen = (await import("pptxgenjs")).default;
  const prs = new pptxgen();

  prs.layout = "LAYOUT_WIDE";
  prs.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });

  const DARK = "080d14";
  const CARD = "111827";
  const EMERALD = "10b981";
  const TEXT = "f1f5f9";
  const MUTED = "94a3b8";

  const addSlide = (title: string, content: (slide: ReturnType<typeof prs.addSlide>) => void) => {
    const slide = prs.addSlide();
    slide.background = { color: DARK };
    // Header bar
    slide.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.6, fill: { color: CARD } });
    // Emerald accent line
    slide.addShape(prs.ShapeType.rect, { x: 0, y: 0.6, w: 13.33, h: 0.04, fill: { color: EMERALD } });
    // Title
    slide.addText(title, {
      x: 0.4, y: 0.1, w: 10, h: 0.45,
      fontSize: 16, bold: true, color: TEXT, fontFace: "Arial",
    });
    // 1GL brand mark
    slide.addText("1GL", {
      x: 12.3, y: 0.1, w: 0.8, h: 0.45,
      fontSize: 14, bold: true, color: EMERALD, fontFace: "Arial", align: "right",
    });
    content(slide);
    return slide;
  };

  // Cover slide
  const cover = prs.addSlide();
  cover.background = { color: DARK };
  cover.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: 7.5, fill: { color: EMERALD } });
  cover.addText("1GigLabs", { x: 0.4, y: 1.5, w: 12, h: 0.6, fontSize: 14, color: EMERALD, fontFace: "Arial" });
  cover.addText(`${report.companyName}`, {
    x: 0.4, y: 2.2, w: 12, h: 1.2, fontSize: 48, bold: true, color: TEXT, fontFace: "Arial",
  });
  cover.addText("Strategic Intelligence Report", {
    x: 0.4, y: 3.5, w: 12, h: 0.5, fontSize: 20, color: MUTED, fontFace: "Arial",
  });
  cover.addText(`Generated ${formatDate(new Date())} · 1GigLabs Insight Generator`, {
    x: 0.4, y: 6.8, w: 12, h: 0.4, fontSize: 10, color: MUTED, fontFace: "Arial",
  });

  // Executive Summary
  addSlide("Executive Summary", (slide) => {
    const es = report.executiveSummary;
    const fields = [
      ["CEO", es.ceo],
      ["Founded", es.founded],
      ["Employees", es.employees],
      ["HQ", es.headquarters],
      ["Exchange", es.stockExchange ?? "Private"],
    ];
    fields.forEach(([label, value], i) => {
      const x = i < 3 ? 0.4 : 4.6;
      const y = 0.9 + (i % 3) * 0.5;
      slide.addText(`${label}:`, { x, y, w: 1.5, h: 0.35, fontSize: 10, color: MUTED, fontFace: "Arial" });
      slide.addText(value, { x: x + 1.5, y, w: 2.5, h: 0.35, fontSize: 10, bold: true, color: TEXT, fontFace: "Arial" });
    });
    slide.addText(es.companyOverview, {
      x: 0.4, y: 2.4, w: 12.5, h: 1.2, fontSize: 11, color: MUTED, fontFace: "Arial", wrap: true,
    });
    es.highlights.forEach((h, i) => {
      slide.addText(`• ${h}`, {
        x: 0.4, y: 3.8 + i * 0.45, w: 12.5, h: 0.4, fontSize: 11, color: TEXT, fontFace: "Arial",
      });
    });
  });

  // Financials
  addSlide("Financial Overview", (slide) => {
    const fin = report.financials;
    const metrics = [
      ["Revenue", fin.revenue],
      ["Growth", fin.revenueGrowth],
      ["Net Income", fin.netIncome],
      ["Market Cap", fin.marketCap],
    ];
    metrics.forEach(([label, value], i) => {
      const x = 0.4 + (i % 2) * 6.4;
      const y = 0.85 + Math.floor(i / 2) * 1.5;
      slide.addShape(prs.ShapeType.rect, { x, y, w: 6, h: 1.2, fill: { color: CARD }, line: { color: "1e2d3d", width: 1 } });
      slide.addText(label, { x: x + 0.2, y: y + 0.1, w: 5.6, h: 0.3, fontSize: 9, color: MUTED, fontFace: "Arial" });
      slide.addText(value, { x: x + 0.2, y: y + 0.45, w: 5.6, h: 0.6, fontSize: 22, bold: true, color: TEXT, fontFace: "Arial" });
    });
    slide.addText(fin.outlook, {
      x: 0.4, y: 4.1, w: 12.5, h: 0.8, fontSize: 11, color: MUTED, fontFace: "Arial", wrap: true,
    });
  });

  // SWOT
  addSlide("SWOT Analysis", (slide) => {
    const swot = report.swot;
    const quadrants = [
      { label: "Strengths", items: swot.strengths, x: 0.4, y: 0.85, color: "064e3b" },
      { label: "Weaknesses", items: swot.weaknesses, x: 6.9, y: 0.85, color: "4c1d1d" },
      { label: "Opportunities", items: swot.opportunities, x: 0.4, y: 4.0, color: "1e3a5f" },
      { label: "Threats", items: swot.threats, x: 6.9, y: 4.0, color: "4c3a1d" },
    ];
    quadrants.forEach(({ label, items, x, y, color }) => {
      slide.addShape(prs.ShapeType.rect, { x, y, w: 6.1, h: 2.8, fill: { color }, line: { color: "1e2d3d", width: 1 } });
      slide.addText(label, { x: x + 0.15, y: y + 0.1, w: 5.8, h: 0.3, fontSize: 11, bold: true, color: EMERALD, fontFace: "Arial" });
      items.slice(0, 3).forEach((item: { title: string }, idx) => {
        slide.addText(`• ${item.title}`, {
          x: x + 0.15, y: y + 0.5 + idx * 0.55, w: 5.8, h: 0.45, fontSize: 10, color: TEXT, fontFace: "Arial",
        });
      });
    });
  });

  // Risks
  addSlide("Risk Assessment", (slide) => {
    report.riskAssessment.risks.slice(0, 5).forEach((risk, i) => {
      const y = 0.85 + i * 1.1;
      slide.addShape(prs.ShapeType.rect, { x: 0.4, y, w: 12.5, h: 0.95, fill: { color: CARD }, line: { color: "1e2d3d", width: 1 } });
      slide.addText(risk.title, { x: 0.6, y: y + 0.08, w: 7, h: 0.3, fontSize: 11, bold: true, color: TEXT, fontFace: "Arial" });
      slide.addText(`${risk.category} · Impact: ${risk.impact} · Likelihood: ${risk.likelihood}`, {
        x: 0.6, y: y + 0.45, w: 8, h: 0.3, fontSize: 9, color: MUTED, fontFace: "Arial",
      });
      const riskColor = risk.impact === "high" ? "ef4444" : risk.impact === "medium" ? "f59e0b" : "10b981";
      slide.addText(risk.impact.toUpperCase(), {
        x: 11, y: y + 0.25, w: 1.7, h: 0.4, fontSize: 11, bold: true, color: riskColor, fontFace: "Arial", align: "right",
      });
    });
  });

  prs.writeFile({ fileName: `${report.companyName.replace(/\s+/g, "_")}_1GL_Report.pptx` });
}

export function exportToHTML(report: ReportData): void {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${report.companyName} — 1GigLabs Intelligence Report</title>
<style>
  body { font-family: Arial, sans-serif; background: #080d14; color: #f1f5f9; margin: 0; padding: 40px; }
  .container { max-width: 900px; margin: 0 auto; }
  h1 { font-size: 2.5rem; color: #10b981; margin-bottom: 0.25rem; }
  h2 { font-size: 1.25rem; color: #10b981; border-bottom: 1px solid #1e2d3d; padding-bottom: 8px; margin: 2rem 0 1rem; }
  h3 { font-size: 1rem; color: #f1f5f9; margin-bottom: 0.25rem; }
  p, li { color: #94a3b8; line-height: 1.6; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 1rem; }
  .card { background: #111827; border: 1px solid #1e2d3d; border-radius: 8px; padding: 16px; }
  .label { font-size: 0.75rem; text-transform: uppercase; color: #475569; margin-bottom: 4px; }
  .value { font-size: 1.5rem; font-weight: bold; color: #f1f5f9; }
  ul { padding-left: 1.5rem; }
  .tag { display: inline-block; background: #064e3b; color: #34d399; border-radius: 4px; padding: 2px 8px; font-size: 0.75rem; margin: 2px; }
  .footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #1e2d3d; font-size: 0.75rem; color: #475569; }
</style>
</head>
<body>
<div class="container">
  <div style="margin-bottom:2rem">
    <div style="color:#475569;font-size:0.875rem;margin-bottom:4px">1GigLabs Insight Generator</div>
    <h1>${report.companyName}</h1>
    <div style="color:#475569">${report.industry} · Generated ${formatDate(new Date())}</div>
  </div>

  <h2>Executive Summary</h2>
  <p>${report.executiveSummary.companyOverview}</p>
  <div class="grid" style="margin-top:1rem">
    <div class="card"><div class="label">CEO</div><div style="color:#f1f5f9;font-weight:bold">${report.executiveSummary.ceo}</div></div>
    <div class="card"><div class="label">Employees</div><div style="color:#f1f5f9;font-weight:bold">${report.executiveSummary.employees}</div></div>
    <div class="card"><div class="label">Founded</div><div style="color:#f1f5f9;font-weight:bold">${report.executiveSummary.founded}</div></div>
    <div class="card"><div class="label">Headquarters</div><div style="color:#f1f5f9;font-weight:bold">${report.executiveSummary.headquarters}</div></div>
  </div>

  <h2>Financials</h2>
  <div class="grid">
    <div class="card"><div class="label">Revenue</div><div class="value">${report.financials.revenue}</div><div style="color:#10b981;font-size:0.875rem">${report.financials.revenueGrowth}</div></div>
    <div class="card"><div class="label">Net Income</div><div class="value">${report.financials.netIncome}</div></div>
    <div class="card"><div class="label">EBITDA</div><div class="value">${report.financials.ebitda}</div></div>
    <div class="card"><div class="label">Market Cap</div><div class="value">${report.financials.marketCap}</div></div>
  </div>
  <p>${report.financials.outlook}</p>

  <h2>SWOT Analysis</h2>
  <div class="grid">
    <div class="card"><h3 style="color:#10b981">Strengths</h3><ul>${report.swot.strengths.map(s => `<li><strong>${s.title}</strong> — ${s.detail}</li>`).join("")}</ul></div>
    <div class="card"><h3 style="color:#ef4444">Weaknesses</h3><ul>${report.swot.weaknesses.map(w => `<li><strong>${w.title}</strong> — ${w.detail}</li>`).join("")}</ul></div>
    <div class="card"><h3 style="color:#3b82f6">Opportunities</h3><ul>${report.swot.opportunities.map(o => `<li><strong>${o.title}</strong> — ${o.detail}</li>`).join("")}</ul></div>
    <div class="card"><h3 style="color:#f59e0b">Threats</h3><ul>${report.swot.threats.map(t => `<li><strong>${t.title}</strong> — ${t.detail}</li>`).join("")}</ul></div>
  </div>

  <h2>Growth Opportunities</h2>
  <p>${report.growthOpportunities.summary}</p>
  ${report.growthOpportunities.opportunities.map(o => `
  <div class="card" style="margin-bottom:8px">
    <h3>${o.title} <span class="tag">${o.potentialValue}</span></h3>
    <p>${o.description}</p>
  </div>`).join("")}

  <h2>Risk Assessment</h2>
  <p>${report.riskAssessment.summary}</p>

  <div class="footer">
    <p>Generated by 1GigLabs Insight Generator · ${formatDate(new Date())} · For internal use only.</p>
    <p>This report was generated using AI and may contain inaccuracies. Always verify data before making strategic decisions.</p>
  </div>
</div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${report.companyName.replace(/\s+/g, "_")}_1GL_Report.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Export Investor Presentation → PPTX ─────────────────────────────────────

export async function exportInvestorPPTX(
  presentation: { title: string; date: string; slides: any[]; disclaimer?: string },
  companyName: string,
): Promise<void> {
  const pptxgen = (await import("pptxgenjs")).default;
  const prs = new pptxgen();

  prs.layout = "LAYOUT_WIDE";
  prs.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });

  const DARK    = "080d14";
  const CARD    = "111827";
  const BLUE    = "3b82f6";
  const TEXT    = "f1f5f9";
  const MUTED   = "94a3b8";
  const BORDER  = "1e2d3d";

  const addStyledSlide = (slideNum: number, title: string, content: (slide: ReturnType<typeof prs.addSlide>) => void) => {
    const slide = prs.addSlide();
    slide.background = { color: DARK };
    // Header bar
    slide.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.65, fill: { color: CARD } });
    // Blue accent line
    slide.addShape(prs.ShapeType.rect, { x: 0, y: 0.65, w: 13.33, h: 0.04, fill: { color: BLUE } });
    // Slide number
    slide.addText(String(slideNum), {
      x: 0.25, y: 0.12, w: 0.45, h: 0.4,
      fontSize: 11, bold: true, color: BLUE, fontFace: "Arial",
    });
    // Slide title
    slide.addText(title, {
      x: 0.8, y: 0.12, w: 10.5, h: 0.4,
      fontSize: 15, bold: true, color: TEXT, fontFace: "Arial",
    });
    // Brand mark
    slide.addText("1GL", {
      x: 12.3, y: 0.12, w: 0.8, h: 0.4,
      fontSize: 13, bold: true, color: BLUE, fontFace: "Arial", align: "right",
    });
    content(slide);
    return slide;
  };

  // Cover slide
  const cover = prs.addSlide();
  cover.background = { color: DARK };
  cover.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: 0.1, h: 7.5, fill: { color: BLUE } });
  cover.addText("1GigLabs", { x: 0.4, y: 1.5, w: 12, h: 0.5, fontSize: 13, color: BLUE, fontFace: "Arial" });
  cover.addText(companyName, {
    x: 0.4, y: 2.1, w: 12.5, h: 1.4, fontSize: 44, bold: true, color: TEXT, fontFace: "Arial",
  });
  cover.addText("Investor Presentation", {
    x: 0.4, y: 3.6, w: 12, h: 0.5, fontSize: 20, color: MUTED, fontFace: "Arial",
  });
  cover.addText(`${presentation.date} · Generated by 1GigLabs Insight Generator`, {
    x: 0.4, y: 6.8, w: 12, h: 0.4, fontSize: 9, color: MUTED, fontFace: "Arial",
  });

  // Content slides
  presentation.slides.forEach((slide: any) => {
    addStyledSlide(slide.slideNumber, slide.title, (s) => {
      // Headline
      if (slide.headline) {
        s.addText(slide.headline, {
          x: 0.4, y: 0.85, w: 12.5, h: 0.45,
          fontSize: 13, color: BLUE, fontFace: "Arial", italic: true,
        });
      }

      // Key metric (top-right callout box)
      if (slide.metric?.value) {
        s.addShape(prs.ShapeType.rect, {
          x: 9.8, y: 0.82, w: 3.1, h: 0.9,
          fill: { color: "0f1e30" }, line: { color: BLUE, width: 1 },
        });
        s.addText(slide.metric.label ?? "", {
          x: 9.9, y: 0.87, w: 2.9, h: 0.25,
          fontSize: 8, color: MUTED, fontFace: "Arial",
        });
        s.addText(slide.metric.value, {
          x: 9.9, y: 1.1, w: 2.9, h: 0.45,
          fontSize: 18, bold: true, color: BLUE, fontFace: "Arial",
        });
      }

      // Bullets
      const bullets: string[] = slide.bullets ?? [];
      bullets.forEach((b: string, i: number) => {
        s.addText(`• ${b}`, {
          x: 0.4, y: 1.55 + i * 0.7, w: (slide.metric?.value ? 9.0 : 12.5), h: 0.6,
          fontSize: 11, color: TEXT, fontFace: "Arial", wrap: true,
        });
      });
    });
  });

  // Disclaimer slide (if present)
  if (presentation.disclaimer) {
    const dis = prs.addSlide();
    dis.background = { color: DARK };
    dis.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.65, fill: { color: CARD } });
    dis.addShape(prs.ShapeType.rect, { x: 0, y: 0.65, w: 13.33, h: 0.04, fill: { color: BORDER } });
    dis.addText("Disclaimer", {
      x: 0.4, y: 0.12, w: 12, h: 0.4, fontSize: 15, bold: true, color: TEXT, fontFace: "Arial",
    });
    dis.addText(presentation.disclaimer, {
      x: 0.4, y: 1.0, w: 12.5, h: 5.5,
      fontSize: 10, color: MUTED, fontFace: "Arial", wrap: true, valign: "top",
    });
  }

  prs.writeFile({ fileName: `${companyName.replace(/\s+/g, "_")}_Investor_Presentation.pptx` });
}
