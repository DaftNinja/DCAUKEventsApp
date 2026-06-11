import type { ReportData } from "@shared/schema";
import { formatDate } from "./utils";

export async function exportToPDF(companyName: string, report?: ReportData): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const { default: html2canvas } = await import("html2canvas");

  // If we have the full report data, render ALL sections into a temporary
  // off-screen container so the PDF isn't limited to the currently-visible tab.
  let element: HTMLElement | null = null;
  let tempContainer: HTMLDivElement | null = null;

  if (report) {
    tempContainer = document.createElement("div");
    tempContainer.style.cssText = "position:absolute;left:-9999px;top:0;width:900px;";
    tempContainer.innerHTML = buildFullReportHTML(report);
    document.body.appendChild(tempContainer);
    element = tempContainer;
  } else {
    element = document.getElementById("report-content");
  }
  if (!element) return;

  try {
    const canvas = await html2canvas(element, {
      scale: 1.5,
      useCORS: true,
      backgroundColor: "#080d14",
      logging: false,
      windowWidth: 900,
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
  } finally {
    if (tempContainer) document.body.removeChild(tempContainer);
  }
}

// Shared HTML builder used by both exportToHTML (download) and exportToPDF (offscreen render)
function buildFullReportHTML(report: ReportData): string {
  const esc = (s: unknown) => String(s ?? "N/A").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const val = (s: unknown) => (s != null && s !== "" && s !== "null") ? esc(s) : "\u2014";

  const es  = report.executiveSummary;
  const fin = report.financials;
  const str = report.strategy;
  const mkt = report.marketAnalysis;
  const tch = report.techSpend;
  const esg = report.esg;
  const swt = report.swot;
  const grw = report.growthOpportunities;
  const rsk = report.riskAssessment;
  const dx  = report.digitalTransformation;

  return `<div style="font-family:Arial,sans-serif;background:#080d14;color:#f1f5f9;padding:40px;max-width:900px;margin:0 auto">
  <div style="margin-bottom:2rem">
    <div style="color:#475569;font-size:0.875rem;margin-bottom:4px">1GigLabs Insight Generator</div>
    <h1 style="font-size:2.5rem;color:#10b981;margin:0 0 0.25rem">${esc(report.companyName)}</h1>
    <div style="color:#475569">${esc(report.industry)} \u00b7 Generated ${formatDate(new Date())}</div>
  </div>

  <h2 style="font-size:1.25rem;color:#10b981;border-bottom:1px solid #1e2d3d;padding-bottom:8px">Executive Summary</h2>
  <p style="color:#94a3b8;line-height:1.6">${esc(es.companyOverview)}</p>
  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin:1rem 0">
    <div style="background:#111827;border:1px solid #1e2d3d;border-radius:8px;padding:16px"><div style="font-size:0.75rem;text-transform:uppercase;color:#475569;margin-bottom:4px">CEO</div><div style="font-weight:bold">${val(es.ceo)}</div></div>
    <div style="background:#111827;border:1px solid #1e2d3d;border-radius:8px;padding:16px"><div style="font-size:0.75rem;text-transform:uppercase;color:#475569;margin-bottom:4px">Employees</div><div style="font-weight:bold">${val(es.employees)}</div></div>
    <div style="background:#111827;border:1px solid #1e2d3d;border-radius:8px;padding:16px"><div style="font-size:0.75rem;text-transform:uppercase;color:#475569;margin-bottom:4px">Founded</div><div style="font-weight:bold">${val(es.founded)}</div></div>
    <div style="background:#111827;border:1px solid #1e2d3d;border-radius:8px;padding:16px"><div style="font-size:0.75rem;text-transform:uppercase;color:#475569;margin-bottom:4px">Headquarters</div><div style="font-weight:bold">${val(es.headquarters)}</div></div>
  </div>
  ${es.highlights?.length ? `<ul style="color:#94a3b8">${es.highlights.map(h => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}

  <h2 style="font-size:1.25rem;color:#10b981;border-bottom:1px solid #1e2d3d;padding-bottom:8px">Financials</h2>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:1rem">
    <div style="background:#111827;border:1px solid #1e2d3d;border-radius:8px;padding:16px"><div style="font-size:0.75rem;text-transform:uppercase;color:#475569">Revenue</div><div style="font-size:1.5rem;font-weight:bold">${val(fin.revenue)}</div><div style="color:#10b981;font-size:0.875rem">${val(fin.revenueGrowth)}</div></div>
    <div style="background:#111827;border:1px solid #1e2d3d;border-radius:8px;padding:16px"><div style="font-size:0.75rem;text-transform:uppercase;color:#475569">Net Income</div><div style="font-size:1.5rem;font-weight:bold">${val(fin.netIncome)}</div></div>
    <div style="background:#111827;border:1px solid #1e2d3d;border-radius:8px;padding:16px"><div style="font-size:0.75rem;text-transform:uppercase;color:#475569">EBITDA</div><div style="font-size:1.5rem;font-weight:bold">${val(fin.ebitda)}</div></div>
    <div style="background:#111827;border:1px solid #1e2d3d;border-radius:8px;padding:16px"><div style="font-size:0.75rem;text-transform:uppercase;color:#475569">Market Cap</div><div style="font-size:1.5rem;font-weight:bold">${val(fin.marketCap)}</div></div>
  </div>
  ${fin.outlook ? `<p style="color:#94a3b8">${esc(fin.outlook)}</p>` : ""}

  <h2 style="font-size:1.25rem;color:#10b981;border-bottom:1px solid #1e2d3d;padding-bottom:8px">Strategy</h2>
  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:1rem">
    <div style="background:#111827;border:1px solid #1e2d3d;border-radius:8px;padding:16px"><div style="font-size:0.75rem;text-transform:uppercase;color:#475569">Vision</div><p style="color:#94a3b8;font-style:italic">${val(str.vision)}</p></div>
    <div style="background:#111827;border:1px solid #1e2d3d;border-radius:8px;padding:16px"><div style="font-size:0.75rem;text-transform:uppercase;color:#475569">Mission</div><p style="color:#94a3b8;font-style:italic">${val(str.mission)}</p></div>
  </div>
  ${str.coreInitiatives?.length ? str.coreInitiatives.map((init, i) => `<p style="color:#94a3b8"><strong style="color:#f1f5f9">${i + 1}. ${esc(init.title)}</strong> (${esc(init.timeline)}) \u2014 ${esc(init.description)}</p>`).join("") : ""}
  ${str.summary ? `<p style="color:#94a3b8">${esc(str.summary)}</p>` : ""}

  <h2 style="font-size:1.25rem;color:#10b981;border-bottom:1px solid #1e2d3d;padding-bottom:8px">Market Analysis</h2>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:1rem">
    <div style="background:#111827;border:1px solid #1e2d3d;border-radius:8px;padding:16px"><div style="font-size:0.75rem;text-transform:uppercase;color:#475569">TAM</div><div style="font-weight:bold">${val(mkt.totalAddressableMarket)}</div></div>
    <div style="background:#111827;border:1px solid #1e2d3d;border-radius:8px;padding:16px"><div style="font-size:0.75rem;text-transform:uppercase;color:#475569">Market Share</div><div style="font-weight:bold">${val(mkt.marketShare)}</div></div>
    <div style="background:#111827;border:1px solid #1e2d3d;border-radius:8px;padding:16px"><div style="font-size:0.75rem;text-transform:uppercase;color:#475569">Position</div><div style="font-weight:bold">${val(mkt.marketPosition)}</div></div>
  </div>
  ${mkt.competitors?.length ? `<p style="color:#94a3b8"><strong style="color:#f1f5f9">Competitors:</strong> ${mkt.competitors.map(c => `${esc(c.name)} (${esc(c.threat)} threat)`).join(", ")}</p>` : ""}
  ${mkt.summary ? `<p style="color:#94a3b8">${esc(mkt.summary)}</p>` : ""}

  <h2 style="font-size:1.25rem;color:#10b981;border-bottom:1px solid #1e2d3d;padding-bottom:8px">Technology &amp; IT Spend</h2>
  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:1rem">
    <div style="background:#111827;border:1px solid #1e2d3d;border-radius:8px;padding:16px"><div style="font-size:0.75rem;text-transform:uppercase;color:#475569">Annual IT Budget</div><div style="font-weight:bold">${val(tch.annualITBudget)}</div></div>
    <div style="background:#111827;border:1px solid #1e2d3d;border-radius:8px;padding:16px"><div style="font-size:0.75rem;text-transform:uppercase;color:#475569">IT as % Revenue</div><div style="font-weight:bold">${val(tch.itBudgetAsPercentRevenue)}</div></div>
  </div>
  ${tch.summary ? `<p style="color:#94a3b8">${esc(tch.summary)}</p>` : ""}

  <h2 style="font-size:1.25rem;color:#10b981;border-bottom:1px solid #1e2d3d;padding-bottom:8px">ESG</h2>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:1rem">
    <div style="background:#111827;border:1px solid #1e2d3d;border-radius:8px;padding:16px"><div style="font-size:0.75rem;text-transform:uppercase;color:#475569">ESG Rating</div><div style="font-weight:bold">${val(esg.overallRating)}</div></div>
    <div style="background:#111827;border:1px solid #1e2d3d;border-radius:8px;padding:16px"><div style="font-size:0.75rem;text-transform:uppercase;color:#475569">Net Zero</div><div style="font-weight:bold">${val(esg.netZeroTarget)}</div></div>
    <div style="background:#111827;border:1px solid #1e2d3d;border-radius:8px;padding:16px"><div style="font-size:0.75rem;text-transform:uppercase;color:#475569">Governance</div><div style="font-weight:bold">${val((esg as any).governanceRating)}</div></div>
    <div style="background:#111827;border:1px solid #1e2d3d;border-radius:8px;padding:16px"><div style="font-size:0.75rem;text-transform:uppercase;color:#475569">Board Diversity</div><div style="font-weight:bold">${val((esg as any).boardDiversity)}</div></div>
  </div>
  ${esg.summary ? `<p style="color:#94a3b8">${esc(esg.summary)}</p>` : ""}

  <h2 style="font-size:1.25rem;color:#10b981;border-bottom:1px solid #1e2d3d;padding-bottom:8px">SWOT Analysis</h2>
  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:1rem">
    <div style="background:#111827;border:1px solid #1e2d3d;border-radius:8px;padding:16px"><h3 style="color:#10b981;font-size:1rem">Strengths</h3><ul style="padding-left:1.5rem">${swt.strengths.map(s => `<li style="color:#94a3b8"><strong style="color:#f1f5f9">${esc(s.title)}</strong> \u2014 ${esc(s.detail)}</li>`).join("")}</ul></div>
    <div style="background:#111827;border:1px solid #1e2d3d;border-radius:8px;padding:16px"><h3 style="color:#ef4444;font-size:1rem">Weaknesses</h3><ul style="padding-left:1.5rem">${swt.weaknesses.map(w => `<li style="color:#94a3b8"><strong style="color:#f1f5f9">${esc(w.title)}</strong> \u2014 ${esc(w.detail)}</li>`).join("")}</ul></div>
    <div style="background:#111827;border:1px solid #1e2d3d;border-radius:8px;padding:16px"><h3 style="color:#3b82f6;font-size:1rem">Opportunities</h3><ul style="padding-left:1.5rem">${swt.opportunities.map(o => `<li style="color:#94a3b8"><strong style="color:#f1f5f9">${esc(o.title)}</strong> \u2014 ${esc(o.detail)}</li>`).join("")}</ul></div>
    <div style="background:#111827;border:1px solid #1e2d3d;border-radius:8px;padding:16px"><h3 style="color:#f59e0b;font-size:1rem">Threats</h3><ul style="padding-left:1.5rem">${swt.threats.map(t => `<li style="color:#94a3b8"><strong style="color:#f1f5f9">${esc(t.title)}</strong> \u2014 ${esc(t.detail)}</li>`).join("")}</ul></div>
  </div>

  <h2 style="font-size:1.25rem;color:#10b981;border-bottom:1px solid #1e2d3d;padding-bottom:8px">Growth Opportunities</h2>
  <p style="color:#94a3b8">${esc(grw.summary)}</p>
  ${grw.opportunities.map(o => `<div style="background:#111827;border:1px solid #1e2d3d;border-radius:8px;padding:16px;margin-bottom:8px"><strong style="color:#f1f5f9">${esc(o.title)}</strong> <span style="background:#064e3b;color:#34d399;border-radius:4px;padding:2px 8px;font-size:0.75rem">${val(o.potentialValue)}</span><p style="color:#94a3b8;margin:4px 0 0">${esc(o.description)}</p></div>`).join("")}

  <h2 style="font-size:1.25rem;color:#10b981;border-bottom:1px solid #1e2d3d;padding-bottom:8px">Risk Assessment</h2>
  <p style="color:#94a3b8">${esc(rsk.summary)}</p>
  ${rsk.risks?.map(r => `<div style="background:#111827;border:1px solid #1e2d3d;border-radius:8px;padding:16px;margin-bottom:8px"><strong style="color:#f1f5f9">${esc(r.title)}</strong> <span style="font-size:0.75rem;color:#475569">${esc(r.category)} \u00b7 Impact: ${esc(r.impact)} \u00b7 Likelihood: ${esc(r.likelihood)}</span><p style="color:#94a3b8;margin:4px 0 0">${esc(r.description)}</p></div>`).join("") ?? ""}

  <h2 style="font-size:1.25rem;color:#10b981;border-bottom:1px solid #1e2d3d;padding-bottom:8px">Digital Transformation</h2>
  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:1rem">
    <div style="background:#111827;border:1px solid #1e2d3d;border-radius:8px;padding:16px"><div style="font-size:0.75rem;text-transform:uppercase;color:#475569">Maturity Level</div><div style="font-weight:bold">${val(dx.maturityLevel)}</div></div>
    <div style="background:#111827;border:1px solid #1e2d3d;border-radius:8px;padding:16px"><div style="font-size:0.75rem;text-transform:uppercase;color:#475569">Maturity Score</div><div style="font-weight:bold">${val(dx.maturityScore)}/10</div></div>
  </div>
  ${dx.summary ? `<p style="color:#94a3b8">${esc(dx.summary)}</p>` : ""}

  <div style="margin-top:3rem;padding-top:1rem;border-top:1px solid #1e2d3d;font-size:0.75rem;color:#475569">
    <p>Generated by 1GigLabs Insight Generator \u00b7 ${formatDate(new Date())} \u00b7 For internal use only.</p>
    <p>This report was generated using AI and may contain inaccuracies. Always verify data before making strategic decisions.</p>
  </div>
</div>`;
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

  // Strategy
  addSlide("Strategy", (slide) => {
    const s = report.strategy;
    // Vision & Mission
    slide.addShape(prs.ShapeType.rect, { x: 0.4, y: 0.85, w: 6, h: 1.6, fill: { color: CARD }, line: { color: "1e2d3d", width: 1 } });
    slide.addText("Vision", { x: 0.6, y: 0.9, w: 5.6, h: 0.25, fontSize: 9, color: MUTED, fontFace: "Arial" });
    slide.addText(s.vision ?? "N/A", { x: 0.6, y: 1.2, w: 5.6, h: 1.0, fontSize: 10, italic: true, color: TEXT, fontFace: "Arial", wrap: true });
    slide.addShape(prs.ShapeType.rect, { x: 6.9, y: 0.85, w: 6, h: 1.6, fill: { color: CARD }, line: { color: "1e2d3d", width: 1 } });
    slide.addText("Mission", { x: 7.1, y: 0.9, w: 5.6, h: 0.25, fontSize: 9, color: MUTED, fontFace: "Arial" });
    slide.addText(s.mission ?? "N/A", { x: 7.1, y: 1.2, w: 5.6, h: 1.0, fontSize: 10, italic: true, color: TEXT, fontFace: "Arial", wrap: true });
    // Core Initiatives
    s.coreInitiatives?.slice(0, 4).forEach((init, i) => {
      const y = 2.7 + i * 1.0;
      slide.addShape(prs.ShapeType.rect, { x: 0.4, y, w: 12.5, h: 0.85, fill: { color: CARD }, line: { color: "1e2d3d", width: 1 } });
      slide.addText(`${i + 1}. ${init.title}`, { x: 0.6, y: y + 0.08, w: 8, h: 0.3, fontSize: 11, bold: true, color: TEXT, fontFace: "Arial" });
      slide.addText(init.timeline, { x: 10.5, y: y + 0.08, w: 2.2, h: 0.3, fontSize: 9, color: EMERALD, fontFace: "Arial", align: "right" });
      slide.addText(init.description, { x: 0.6, y: y + 0.4, w: 12, h: 0.35, fontSize: 9, color: MUTED, fontFace: "Arial", wrap: true });
    });
  });

  // Market Analysis
  addSlide("Market Analysis", (slide) => {
    const m = report.marketAnalysis;
    const metrics = [
      ["Total Addressable Market", m.totalAddressableMarket],
      ["Market Share", m.marketShare],
      ["Market Position", m.marketPosition],
    ];
    metrics.forEach(([label, value], i) => {
      const x = 0.4 + i * 4.3;
      slide.addShape(prs.ShapeType.rect, { x, y: 0.85, w: 3.9, h: 1.1, fill: { color: CARD }, line: { color: "1e2d3d", width: 1 } });
      slide.addText(label, { x: x + 0.2, y: 0.9, w: 3.5, h: 0.3, fontSize: 9, color: MUTED, fontFace: "Arial" });
      slide.addText(value ?? "N/A", { x: x + 0.2, y: 1.25, w: 3.5, h: 0.5, fontSize: 18, bold: true, color: TEXT, fontFace: "Arial" });
    });
    // Competitors
    slide.addText("Top Competitors", { x: 0.4, y: 2.2, w: 12, h: 0.3, fontSize: 11, bold: true, color: EMERALD, fontFace: "Arial" });
    m.competitors?.slice(0, 5).forEach((c, i) => {
      const y = 2.6 + i * 0.55;
      slide.addText(c.name, { x: 0.6, y, w: 3, h: 0.4, fontSize: 10, bold: true, color: TEXT, fontFace: "Arial" });
      slide.addText(c.strength, { x: 3.8, y, w: 6, h: 0.4, fontSize: 9, color: MUTED, fontFace: "Arial" });
      const threatColor = c.threat === "high" ? "ef4444" : c.threat === "medium" ? "f59e0b" : "10b981";
      slide.addText(c.threat, { x: 10.5, y, w: 2.2, h: 0.4, fontSize: 9, bold: true, color: threatColor, fontFace: "Arial", align: "right" });
    });
    if (m.summary) {
      slide.addText(m.summary, { x: 0.4, y: 5.6, w: 12.5, h: 0.8, fontSize: 10, color: MUTED, fontFace: "Arial", wrap: true });
    }
  });

  // Tech Spend
  addSlide("Technology & IT Spend", (slide) => {
    const t = report.techSpend;
    const metrics = [
      ["Annual IT Budget", t.annualITBudget],
      ["IT as % Revenue", t.itBudgetAsPercentRevenue],
    ];
    metrics.forEach(([label, value], i) => {
      const x = 0.4 + i * 6.4;
      slide.addShape(prs.ShapeType.rect, { x, y: 0.85, w: 6, h: 1.1, fill: { color: CARD }, line: { color: "1e2d3d", width: 1 } });
      slide.addText(label, { x: x + 0.2, y: 0.9, w: 5.6, h: 0.3, fontSize: 9, color: MUTED, fontFace: "Arial" });
      slide.addText(value ?? "N/A", { x: x + 0.2, y: 1.25, w: 5.6, h: 0.5, fontSize: 18, bold: true, color: TEXT, fontFace: "Arial" });
    });
    // Cloud & Emerging Tech
    if (t.cloudPlatforms?.length) {
      slide.addText("Cloud Platforms", { x: 0.4, y: 2.2, w: 12, h: 0.3, fontSize: 9, color: MUTED, fontFace: "Arial" });
      slide.addText(t.cloudPlatforms.join("  ·  "), { x: 0.4, y: 2.5, w: 12, h: 0.35, fontSize: 11, bold: true, color: TEXT, fontFace: "Arial" });
    }
    // Key Vendors
    t.keyVendors?.slice(0, 5).forEach((v, i) => {
      const y = 3.1 + i * 0.55;
      slide.addText(v.vendor, { x: 0.6, y, w: 3, h: 0.4, fontSize: 10, bold: true, color: TEXT, fontFace: "Arial" });
      slide.addText(v.category, { x: 3.8, y, w: 3, h: 0.4, fontSize: 9, color: MUTED, fontFace: "Arial" });
      slide.addText(v.relationship, { x: 7, y, w: 5.5, h: 0.4, fontSize: 9, color: MUTED, fontFace: "Arial" });
    });
    if (t.summary) {
      slide.addText(t.summary, { x: 0.4, y: 6.2, w: 12.5, h: 0.8, fontSize: 10, color: MUTED, fontFace: "Arial", wrap: true });
    }
  });

  // ESG
  addSlide("ESG", (slide) => {
    const e = report.esg;
    const cards = [
      ["ESG Rating", e.overallRating],
      ["Net Zero Target", e.netZeroTarget],
      ["Governance", (e as any).governanceRating],
      ["Board Diversity", (e as any).boardDiversity],
    ];
    cards.forEach(([label, value], i) => {
      const x = 0.4 + i * 3.2;
      slide.addShape(prs.ShapeType.rect, { x, y: 0.85, w: 2.9, h: 1.1, fill: { color: CARD }, line: { color: "1e2d3d", width: 1 } });
      slide.addText(label, { x: x + 0.15, y: 0.9, w: 2.6, h: 0.25, fontSize: 9, color: MUTED, fontFace: "Arial" });
      slide.addText(value ?? "N/A", { x: x + 0.15, y: 1.2, w: 2.6, h: 0.5, fontSize: 14, bold: true, color: TEXT, fontFace: "Arial" });
    });
    // Initiatives side-by-side
    slide.addShape(prs.ShapeType.rect, { x: 0.4, y: 2.2, w: 6.1, h: 2.8, fill: { color: CARD }, line: { color: "1e2d3d", width: 1 } });
    slide.addText("Environmental Initiatives", { x: 0.6, y: 2.3, w: 5.8, h: 0.3, fontSize: 10, bold: true, color: EMERALD, fontFace: "Arial" });
    e.environmentalInitiatives?.slice(0, 4).forEach((item, i) => {
      slide.addText(`🌱 ${item}`, { x: 0.6, y: 2.7 + i * 0.5, w: 5.8, h: 0.4, fontSize: 9, color: TEXT, fontFace: "Arial" });
    });
    slide.addShape(prs.ShapeType.rect, { x: 6.9, y: 2.2, w: 6.1, h: 2.8, fill: { color: CARD }, line: { color: "1e2d3d", width: 1 } });
    slide.addText("Social Initiatives", { x: 7.1, y: 2.3, w: 5.8, h: 0.3, fontSize: 10, bold: true, color: "60a5fa", fontFace: "Arial" });
    e.socialInitiatives?.slice(0, 4).forEach((item, i) => {
      slide.addText(`🤝 ${item}`, { x: 7.1, y: 2.7 + i * 0.5, w: 5.8, h: 0.4, fontSize: 9, color: TEXT, fontFace: "Arial" });
    });
    if (e.summary) {
      slide.addText(e.summary, { x: 0.4, y: 5.3, w: 12.5, h: 1.0, fontSize: 10, color: MUTED, fontFace: "Arial", wrap: true });
    }
  });

  // Growth Opportunities
  addSlide("Growth Opportunities", (slide) => {
    const g = report.growthOpportunities;
    if (g.totalOpportunityValue) {
      slide.addText("Total Opportunity Value", { x: 0.4, y: 0.85, w: 5, h: 0.3, fontSize: 9, color: MUTED, fontFace: "Arial" });
      slide.addText(g.totalOpportunityValue, { x: 0.4, y: 1.1, w: 8, h: 0.5, fontSize: 22, bold: true, color: EMERALD, fontFace: "Arial" });
    }
    g.opportunities.slice(0, 4).forEach((opp, i) => {
      const y = 1.8 + i * 1.2;
      slide.addShape(prs.ShapeType.rect, { x: 0.4, y, w: 12.5, h: 1.05, fill: { color: CARD }, line: { color: "1e2d3d", width: 1 } });
      slide.addText(opp.title, { x: 0.6, y: y + 0.08, w: 7, h: 0.3, fontSize: 11, bold: true, color: TEXT, fontFace: "Arial" });
      slide.addText(opp.potentialValue ?? "", { x: 8, y: y + 0.08, w: 2.5, h: 0.3, fontSize: 10, bold: true, color: EMERALD, fontFace: "Arial", align: "right" });
      const confColor = opp.confidence === "high" ? EMERALD : opp.confidence === "medium" ? "f59e0b" : "ef4444";
      slide.addText(opp.confidence ?? "", { x: 10.8, y: y + 0.08, w: 2, h: 0.3, fontSize: 9, color: confColor, fontFace: "Arial", align: "right" });
      slide.addText(opp.description, { x: 0.6, y: y + 0.45, w: 12, h: 0.5, fontSize: 9, color: MUTED, fontFace: "Arial", wrap: true });
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

  // Digital Transformation
  addSlide("Digital Transformation", (slide) => {
    const dx = report.digitalTransformation;
    // Maturity cards
    slide.addShape(prs.ShapeType.rect, { x: 0.4, y: 0.85, w: 6, h: 1.2, fill: { color: CARD }, line: { color: "1e2d3d", width: 1 } });
    slide.addText("Maturity Level", { x: 0.6, y: 0.9, w: 5.6, h: 0.3, fontSize: 9, color: MUTED, fontFace: "Arial" });
    slide.addText((dx.maturityLevel ?? "N/A").charAt(0).toUpperCase() + (dx.maturityLevel ?? "").slice(1), {
      x: 0.6, y: 1.25, w: 5.6, h: 0.5, fontSize: 22, bold: true, color: TEXT, fontFace: "Arial",
    });
    slide.addShape(prs.ShapeType.rect, { x: 6.9, y: 0.85, w: 6, h: 1.2, fill: { color: CARD }, line: { color: "1e2d3d", width: 1 } });
    slide.addText("Maturity Score", { x: 7.1, y: 0.9, w: 5.6, h: 0.3, fontSize: 9, color: MUTED, fontFace: "Arial" });
    slide.addText(`${dx.maturityScore ?? "N/A"}/10`, {
      x: 7.1, y: 1.25, w: 5.6, h: 0.5, fontSize: 22, bold: true, color: TEXT, fontFace: "Arial",
    });
    // Key Initiatives
    dx.keyInitiatives?.slice(0, 4).forEach((init, i) => {
      const y = 2.3 + i * 0.9;
      slide.addShape(prs.ShapeType.rect, { x: 0.4, y, w: 12.5, h: 0.75, fill: { color: CARD }, line: { color: "1e2d3d", width: 1 } });
      const statusColor = init.status === "live" ? EMERALD : init.status === "in_progress" ? "f59e0b" : "60a5fa";
      slide.addText(init.status.replace("_", " "), { x: 0.6, y: y + 0.08, w: 1.5, h: 0.25, fontSize: 8, bold: true, color: statusColor, fontFace: "Arial" });
      slide.addText(init.title, { x: 2.2, y: y + 0.08, w: 8, h: 0.25, fontSize: 10, bold: true, color: TEXT, fontFace: "Arial" });
      slide.addText(init.description, { x: 2.2, y: y + 0.38, w: 10.5, h: 0.3, fontSize: 9, color: MUTED, fontFace: "Arial", wrap: true });
    });
    // AI & Data
    slide.addShape(prs.ShapeType.rect, { x: 0.4, y: 5.9, w: 6, h: 1.2, fill: { color: CARD }, line: { color: "1e2d3d", width: 1 } });
    slide.addText("AI Adoption", { x: 0.6, y: 5.95, w: 5.6, h: 0.25, fontSize: 9, color: MUTED, fontFace: "Arial" });
    slide.addText(dx.aiAdoption ?? "N/A", { x: 0.6, y: 6.25, w: 5.6, h: 0.7, fontSize: 9, color: TEXT, fontFace: "Arial", wrap: true });
    slide.addShape(prs.ShapeType.rect, { x: 6.9, y: 5.9, w: 6, h: 1.2, fill: { color: CARD }, line: { color: "1e2d3d", width: 1 } });
    slide.addText("Data Strategy", { x: 7.1, y: 5.95, w: 5.6, h: 0.25, fontSize: 9, color: MUTED, fontFace: "Arial" });
    slide.addText(dx.dataStrategy ?? "N/A", { x: 7.1, y: 6.25, w: 5.6, h: 0.7, fontSize: 9, color: TEXT, fontFace: "Arial", wrap: true });
  });

  prs.writeFile({ fileName: `${report.companyName.replace(/\s+/g, "_")}_1GL_Report.pptx` });
}

export function exportToHTML(report: ReportData): void {
  const esc = (s: unknown) => String(s ?? "N/A").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const val = (s: unknown) => (s != null && s !== "" && s !== "null") ? esc(s) : "—";

  const es  = report.executiveSummary;
  const fin = report.financials;
  const str = report.strategy;
  const mkt = report.marketAnalysis;
  const tch = report.techSpend;
  const esg = report.esg;
  const swt = report.swot;
  const grw = report.growthOpportunities;
  const rsk = report.riskAssessment;
  const dx  = report.digitalTransformation;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(report.companyName)} — 1GigLabs Intelligence Report</title>
<style>
  body { font-family: Arial, sans-serif; background: #080d14; color: #f1f5f9; margin: 0; padding: 40px; }
  .container { max-width: 900px; margin: 0 auto; }
  h1 { font-size: 2.5rem; color: #10b981; margin-bottom: 0.25rem; }
  h2 { font-size: 1.25rem; color: #10b981; border-bottom: 1px solid #1e2d3d; padding-bottom: 8px; margin: 2rem 0 1rem; }
  h3 { font-size: 1rem; color: #f1f5f9; margin-bottom: 0.25rem; }
  p, li { color: #94a3b8; line-height: 1.6; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 1rem; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 1rem; }
  .card { background: #111827; border: 1px solid #1e2d3d; border-radius: 8px; padding: 16px; }
  .label { font-size: 0.75rem; text-transform: uppercase; color: #475569; margin-bottom: 4px; }
  .value { font-size: 1.5rem; font-weight: bold; color: #f1f5f9; }
  .value-sm { font-size: 1rem; font-weight: bold; color: #f1f5f9; }
  ul { padding-left: 1.5rem; }
  .tag { display: inline-block; background: #064e3b; color: #34d399; border-radius: 4px; padding: 2px 8px; font-size: 0.75rem; margin: 2px; }
  .tag-blue { display: inline-block; background: #1e3a5f; color: #60a5fa; border-radius: 4px; padding: 2px 8px; font-size: 0.75rem; margin: 2px; }
  .tag-amber { display: inline-block; background: #4c3a1d; color: #fbbf24; border-radius: 4px; padding: 2px 8px; font-size: 0.75rem; margin: 2px; }
  .tag-violet { display: inline-block; background: #2e1065; color: #a78bfa; border-radius: 4px; padding: 2px 8px; font-size: 0.75rem; margin: 2px; }
  table { width: 100%; border-collapse: collapse; margin: 0.5rem 0; }
  th { text-align: left; padding: 8px; font-size: 0.75rem; text-transform: uppercase; color: #475569; border-bottom: 1px solid #1e2d3d; }
  td { padding: 8px; font-size: 0.875rem; color: #94a3b8; border-bottom: 1px solid #1e2d3d; }
  .bar-bg { height: 8px; border-radius: 4px; background: #1e2d3d; }
  .bar-fill { height: 8px; border-radius: 4px; background: #10b981; }
  .footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #1e2d3d; font-size: 0.75rem; color: #475569; }
  @media (max-width: 640px) { .grid-4 { grid-template-columns: repeat(2, 1fr); } }
</style>
</head>
<body>
<div class="container">
  <div style="margin-bottom:2rem">
    <div style="color:#475569;font-size:0.875rem;margin-bottom:4px">1GigLabs Insight Generator</div>
    <h1>${esc(report.companyName)}</h1>
    <div style="color:#475569">${esc(report.industry)} · Generated ${formatDate(new Date())}</div>
  </div>

  <!-- ═══ EXECUTIVE SUMMARY ═══ -->
  <h2>Executive Summary</h2>
  <p>${esc(es.companyOverview)}</p>
  <div class="grid" style="margin-top:1rem">
    <div class="card"><div class="label">CEO</div><div class="value-sm">${val(es.ceo)}</div></div>
    <div class="card"><div class="label">Employees</div><div class="value-sm">${val(es.employees)}</div></div>
    <div class="card"><div class="label">Founded</div><div class="value-sm">${val(es.founded)}</div></div>
    <div class="card"><div class="label">Headquarters</div><div class="value-sm">${val(es.headquarters)}</div></div>
  </div>
  ${es.highlights?.length ? `<div class="card" style="margin-top:1rem"><div class="label">Key Highlights</div><ul>${es.highlights.map(h => `<li>${esc(h)}</li>`).join("")}</ul></div>` : ""}
  ${es.keyExecutives?.length ? `<div class="card" style="margin-top:1rem"><div class="label">Key Executives</div><table><thead><tr><th>Name</th><th>Title</th></tr></thead><tbody>${es.keyExecutives.map(e => `<tr><td style="color:#f1f5f9;font-weight:600">${esc(e.name)}</td><td>${esc(e.title)}</td></tr>`).join("")}</tbody></table></div>` : ""}

  <!-- ═══ FINANCIALS ═══ -->
  <h2>Financials</h2>
  <div class="grid-4">
    <div class="card"><div class="label">Revenue</div><div class="value">${val(fin.revenue)}</div><div style="color:#10b981;font-size:0.875rem">${val(fin.revenueGrowth)}</div></div>
    <div class="card"><div class="label">Net Income</div><div class="value">${val(fin.netIncome)}</div></div>
    <div class="card"><div class="label">EBITDA</div><div class="value">${val(fin.ebitda)}</div></div>
    <div class="card"><div class="label">Market Cap</div><div class="value">${val(fin.marketCap)}</div></div>
  </div>
  ${fin.keyMetrics?.length ? `<div class="grid-4">${fin.keyMetrics.map(m => `<div class="card"><div class="label">${esc(m.label)}</div><div class="value-sm">${val(m.value)}</div></div>`).join("")}</div>` : ""}
  ${fin.revenueHistory?.length ? `<div class="card"><div class="label">Revenue History</div><table><thead><tr><th>Year</th><th>Revenue</th><th>Growth</th></tr></thead><tbody>${fin.revenueHistory.map(r => `<tr><td style="color:#f1f5f9">${esc(r.year)}</td><td>${esc(r.revenue)}</td><td style="color:#10b981">${esc(r.growth)}</td></tr>`).join("")}</tbody></table></div>` : ""}
  ${fin.outlook ? `<p>${esc(fin.outlook)}</p>` : ""}

  <!-- ═══ STRATEGY ═══ -->
  <h2>Strategy</h2>
  <div class="grid">
    <div class="card"><div class="label">Vision</div><p style="font-style:italic">${val(str.vision)}</p></div>
    <div class="card"><div class="label">Mission</div><p style="font-style:italic">${val(str.mission)}</p></div>
  </div>
  ${str.coreInitiatives?.length ? `<div class="card"><div class="label">Core Strategic Initiatives</div>${str.coreInitiatives.map((init, i) => `<div style="padding:12px 0;border-bottom:1px solid #1e2d3d"><strong style="color:#f1f5f9">${i + 1}. ${esc(init.title)}</strong> <span class="tag-blue">${esc(init.timeline)}</span><p style="margin:4px 0 0">${esc(init.description)}</p></div>`).join("")}</div>` : ""}
  <div class="grid">
    <div class="card"><div class="label">M&amp;A Strategy</div><p>${val(str.mAndA)}</p></div>
    <div class="card"><div class="label">Capital Allocation</div><p>${val(str.capitalAllocation)}</p></div>
  </div>
  ${str.geographicFocus?.length ? `<div class="card"><div class="label">Geographic Focus</div><div>${str.geographicFocus.map(r => `<span class="tag-blue">${esc(r)}</span>`).join(" ")}</div></div>` : ""}
  ${str.summary ? `<p>${esc(str.summary)}</p>` : ""}

  <!-- ═══ MARKET ANALYSIS ═══ -->
  <h2>Market Analysis</h2>
  <div class="grid" style="grid-template-columns:repeat(3,1fr)">
    <div class="card"><div class="label">Total Addressable Market</div><div class="value-sm">${val(mkt.totalAddressableMarket)}</div></div>
    <div class="card"><div class="label">Market Share</div><div class="value-sm">${val(mkt.marketShare)}</div></div>
    <div class="card"><div class="label">Market Position</div><div class="value-sm">${val(mkt.marketPosition)}</div></div>
  </div>
  ${mkt.competitors?.length ? `<div class="card"><div class="label">Top Competitors</div><table><thead><tr><th>Name</th><th>Strength</th><th>Threat Level</th></tr></thead><tbody>${mkt.competitors.map(c => `<tr><td style="color:#f1f5f9;font-weight:600">${esc(c.name)}</td><td>${esc(c.strength)}</td><td><span class="tag-amber">${esc(c.threat)}</span></td></tr>`).join("")}</tbody></table></div>` : ""}
  ${mkt.geographicPresence?.length ? `<div class="card"><div class="label">Geographic Revenue Mix</div>${mkt.geographicPresence.map(g => `<div style="display:flex;align-items:center;gap:12px;margin:8px 0"><span style="width:80px;font-size:0.75rem;color:#475569">${esc(g.region)}</span><div class="bar-bg" style="flex:1"><div class="bar-fill" style="width:${esc(g.percentage)}"></div></div><span style="width:40px;text-align:right;font-size:0.75rem;color:#f1f5f9">${esc(g.percentage)}</span></div>`).join("")}</div>` : ""}
  ${mkt.customerSegments?.length ? `<div class="card"><div class="label">Customer Segments</div><div>${mkt.customerSegments.map(s => `<span class="tag-blue">${esc(s)}</span>`).join(" ")}</div></div>` : ""}
  ${mkt.marketTrends?.length ? `<div class="card"><div class="label">Market Trends</div><ul>${mkt.marketTrends.map(t => `<li>→ ${esc(t)}</li>`).join("")}</ul></div>` : ""}
  ${mkt.summary ? `<p>${esc(mkt.summary)}</p>` : ""}

  <!-- ═══ TECH SPEND ═══ -->
  <h2>Technology &amp; IT Spend</h2>
  <div class="grid">
    <div class="card"><div class="label">Annual IT Budget</div><div class="value-sm">${val(tch.annualITBudget)}</div></div>
    <div class="card"><div class="label">IT Budget as % Revenue</div><div class="value-sm">${val(tch.itBudgetAsPercentRevenue)}</div></div>
  </div>
  ${tch.cloudPlatforms?.length ? `<div class="card"><div class="label">Cloud Platforms</div><div>${tch.cloudPlatforms.map(p => `<span class="tag-blue">${esc(p)}</span>`).join(" ")}</div></div>` : ""}
  ${tch.keyVendors?.length ? `<div class="card"><div class="label">Key Technology Vendors</div><table><thead><tr><th>Vendor</th><th>Category</th><th>Relationship</th></tr></thead><tbody>${tch.keyVendors.map(v => `<tr><td style="color:#f1f5f9;font-weight:600">${esc(v.vendor)}</td><td>${esc(v.category)}</td><td>${esc(v.relationship)}</td></tr>`).join("")}</tbody></table></div>` : ""}
  <div class="grid">
    <div class="card"><div class="label">Data Infrastructure</div><p>${val(tch.dataInfrastructure)}</p></div>
    <div class="card"><div class="label">Security Posture</div><p>${val(tch.securityPosture)}</p></div>
  </div>
  ${tch.emergingTech?.length ? `<div class="card"><div class="label">Emerging Technology Investments</div><div>${tch.emergingTech.map(t => `<span class="tag-violet">${esc(t)}</span>`).join(" ")}</div></div>` : ""}
  ${tch.summary ? `<p>${esc(tch.summary)}</p>` : ""}

  <!-- ═══ ESG ═══ -->
  <h2>ESG</h2>
  <div class="grid-4">
    <div class="card"><div class="label">ESG Rating</div><div class="value-sm">${val(esg.overallRating)}</div></div>
    <div class="card"><div class="label">Net Zero Target</div><div class="value-sm">${val(esg.netZeroTarget)}</div></div>
    <div class="card"><div class="label">Governance</div><div class="value-sm">${val((esg as any).governanceRating)}</div></div>
    <div class="card"><div class="label">Board Diversity</div><div class="value-sm">${val((esg as any).boardDiversity)}</div></div>
  </div>
  <div class="grid">
    ${esg.environmentalInitiatives?.length ? `<div class="card"><div class="label" style="color:#10b981">Environmental Initiatives</div><ul>${esg.environmentalInitiatives.map(i => `<li>🌱 ${esc(i)}</li>`).join("")}</ul></div>` : ""}
    ${esg.socialInitiatives?.length ? `<div class="card"><div class="label" style="color:#60a5fa">Social Initiatives</div><ul>${esg.socialInitiatives.map(i => `<li>🤝 ${esc(i)}</li>`).join("")}</ul></div>` : ""}
  </div>
  ${esg.esgRisks?.length ? `<div class="card"><div class="label">ESG Risk Factors</div><div>${esg.esgRisks.map(r => `<span class="tag-amber">${esc(r)}</span>`).join(" ")}</div></div>` : ""}
  ${esg.summary ? `<p>${esc(esg.summary)}</p>` : ""}

  <!-- ═══ SWOT ═══ -->
  <h2>SWOT Analysis</h2>
  <div class="grid">
    <div class="card"><h3 style="color:#10b981">Strengths</h3><ul>${swt.strengths.map(s => `<li><strong>${esc(s.title)}</strong> — ${esc(s.detail)}</li>`).join("")}</ul></div>
    <div class="card"><h3 style="color:#ef4444">Weaknesses</h3><ul>${swt.weaknesses.map(w => `<li><strong>${esc(w.title)}</strong> — ${esc(w.detail)}</li>`).join("")}</ul></div>
    <div class="card"><h3 style="color:#3b82f6">Opportunities</h3><ul>${swt.opportunities.map(o => `<li><strong>${esc(o.title)}</strong> — ${esc(o.detail)}</li>`).join("")}</ul></div>
    <div class="card"><h3 style="color:#f59e0b">Threats</h3><ul>${swt.threats.map(t => `<li><strong>${esc(t.title)}</strong> — ${esc(t.detail)}</li>`).join("")}</ul></div>
  </div>

  <!-- ═══ GROWTH OPPORTUNITIES ═══ -->
  <h2>Growth Opportunities</h2>
  ${grw.totalOpportunityValue ? `<div class="card" style="margin-bottom:1rem"><div class="label">Total Opportunity Value</div><div class="value" style="color:#10b981">${esc(grw.totalOpportunityValue)}</div></div>` : ""}
  <p>${esc(grw.summary)}</p>
  ${grw.opportunities.map(o => `
  <div class="card" style="margin-bottom:8px">
    <h3>${esc(o.title)} <span class="tag">${val(o.potentialValue)}</span> ${o.confidence ? `<span class="tag-blue">${esc(o.confidence)}</span>` : ""}</h3>
    <p>${esc(o.description)}</p>
    ${o.timeframe ? `<div style="font-size:0.75rem;color:#475569;margin-top:4px">⏱ ${esc(o.timeframe)}</div>` : ""}
  </div>`).join("")}

  <!-- ═══ RISK ASSESSMENT ═══ -->
  <h2>Risk Assessment</h2>
  <div class="card" style="margin-bottom:1rem"><div class="label">Overall Risk Level</div><div class="value-sm" style="color:${rsk.overallRiskLevel === 'high' ? '#ef4444' : rsk.overallRiskLevel === 'medium' ? '#f59e0b' : '#10b981'}">${val(rsk.overallRiskLevel).toUpperCase()}</div></div>
  <p>${esc(rsk.summary)}</p>
  ${rsk.risks?.length ? rsk.risks.map(r => `
  <div class="card" style="margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:start"><h3>${esc(r.title)}</h3><span class="tag-amber">${esc(r.category)}</span></div>
    <p>${esc(r.description)}</p>
    <div style="font-size:0.75rem;color:#475569;margin-top:6px">Impact: <strong style="color:#f1f5f9">${esc(r.impact)}</strong> · Likelihood: <strong style="color:#f1f5f9">${esc(r.likelihood)}</strong></div>
    ${r.mitigation ? `<div style="font-size:0.75rem;color:#475569;margin-top:4px">Mitigation: ${esc(r.mitigation)}</div>` : ""}
  </div>`).join("") : ""}

  <!-- ═══ DIGITAL TRANSFORMATION ═══ -->
  <h2>Digital Transformation</h2>
  <div class="grid">
    <div class="card"><div class="label">Maturity Level</div><div class="value-sm">${val(dx.maturityLevel)}</div></div>
    <div class="card"><div class="label">Maturity Score</div><div class="value-sm">${val(dx.maturityScore)}<span style="color:#475569">/10</span></div>
      <div class="bar-bg" style="margin-top:8px"><div class="bar-fill" style="width:${((dx.maturityScore ?? 0) / 10) * 100}%"></div></div>
    </div>
  </div>
  ${dx.keyInitiatives?.length ? `<div class="card"><div class="label">Key Initiatives</div>${dx.keyInitiatives.map(init => `<div style="padding:10px 0;border-bottom:1px solid #1e2d3d"><span class="tag-blue">${esc(init.status?.replace("_", " "))}</span> <strong style="color:#f1f5f9;margin-left:8px">${esc(init.title)}</strong><p style="margin:4px 0 0">${esc(init.description)}</p></div>`).join("")}</div>` : ""}
  <div class="grid">
    <div class="card"><div class="label">AI Adoption</div><p>${val(dx.aiAdoption)}</p></div>
    <div class="card"><div class="label">Data Strategy</div><p>${val(dx.dataStrategy)}</p></div>
  </div>
  ${dx.challenges?.length ? `<div class="card"><div class="label">Transformation Challenges</div><ul>${dx.challenges.map(c => `<li>⚠ ${esc(c)}</li>`).join("")}</ul></div>` : ""}
  ${dx.summary ? `<p>${esc(dx.summary)}</p>` : ""}

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
