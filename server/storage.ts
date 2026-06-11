import { db } from "./db.js";
import { reports } from "../shared/schema.js";
import type { InsertReport, Report } from "../shared/schema.js";
import { eq, desc } from "drizzle-orm";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function getReportBySlug(slug: string): Promise<Report | null> {
  const rows = await db.select().from(reports).where(eq(reports.companySlug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getReportById(id: number): Promise<Report | null> {
  const rows = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getAllReports(): Promise<Report[]> {
  return db.select().from(reports).orderBy(desc(reports.generatedAt));
}

export async function createOrUpdateReport(data: Partial<InsertReport> & { companyName: string }): Promise<Report> {
  const slug = slugify(data.companyName);
  const existing = await getReportBySlug(slug);

  if (existing) {
    const [updated] = await db
      .update(reports)
      .set({ ...data, companySlug: slug, generatedAt: new Date(), updatedAt: new Date() })
      .where(eq(reports.companySlug, slug))
      .returning();
    return updated;
  } else {
    const [created] = await db
      .insert(reports)
      .values({ ...data, companySlug: slug })
      .returning();
    return created;
  }
}

export async function updateSalesEnablement(slug: string, salesData: unknown): Promise<Report | null> {
  const [updated] = await db
    .update(reports)
    .set({ salesEnablementData: salesData, updatedAt: new Date() })
    .where(eq(reports.companySlug, slug))
    .returning();
  return updated ?? null;
}

export async function deleteReport(id: number): Promise<void> {
  await db.delete(reports).where(eq(reports.id, id));
}

export async function isCacheValid(report: Report): Promise<boolean> {
  if (!report.generatedAt) return false;
  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
  return report.generatedAt > twoMonthsAgo && !!report.reportData;
}

export { slugify };
