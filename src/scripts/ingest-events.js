
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import pg from "pg";
import { v4 as uuidv4 } from "uuid";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function ingestEvents() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });

  try {
    console.log("📥 Ingesting events...");

    // Check if events already exist
    const existingResult = await pool.query(
      'SELECT COUNT(*) as count FROM events WHERE "organizerEmail" = $1',
      ["andrew@mccreath.vip"]
    );
    const existingCount = parseInt(existingResult.rows[0].count);

    if (existingCount > 0) {
      console.log(`⏭️  ${existingCount} events already ingested, skipping`);
      await pool.end();
      return;
    }

    // Read CSV file
    const csvPath = path.join(__dirname, "../events.csv");
    if (!fs.existsSync(csvPath)) {
      console.log("⚠️  events.csv not found at src/events.csv, skipping ingestion");
      await pool.end();
      return;
    }

    const fileContent = fs.readFileSync(csvPath, "utf-8");

    // Parse as tab-separated, stripping surrounding quotes from the header/rows
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      delimiter: "\t",
      quote: '"',
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
    });

    console.log(`Found ${records.length} events to ingest`);

    // Get or create organiser user
    const userResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      ["andrew@mccreath.vip"]
    );

    let organizerId;
    if (userResult.rows.length > 0) {
      organizerId = userResult.rows[0].id;
      console.log(`✓ Using existing user: ${organizerId}`);
    } else {
      const newUser = await pool.query(
        `INSERT INTO users ("linkedinId", email, name, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING id`,
        ["andrew-placeholder", "andrew@mccreath.vip", "Andrew McCreath"]
      );
      organizerId = newUser.rows[0].id;
      console.log(`✓ Created organiser user: ${organizerId}`);
    }

    let inserted = 0;
    let failed = 0;

    for (const record of records) {
      try {
        const eventName = record["Event Name"]?.trim();
        if (!eventName) {
          failed++;
          continue;
        }

        // Parse DD/MM/YYYY dates, combining with time if available
        const startDate = parseDate(record["Start Date"], record["Start Time"]);
        const endDate = parseDate(record["End Date"], record["End Time"]) || startDate;

        if (!startDate) {
          console.warn(`  ✗ ${eventName}: Invalid date "${record["Start Date"]}"`);
          failed++;
          continue;
        }

        const eventId = uuidv4();

        await pool.query(
          `INSERT INTO events (
            id, title, description, "startDate", "endDate",
            location, "eventUrl", "organizerId", "organizerEmail",
            status, "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
          [
            eventId,
            eventName,
            record["Description"]?.trim() || "",
            startDate,
            endDate,
            record["Venue / Location"]?.trim() || null,
            record["URL"]?.trim() || null,
            organizerId,
            "andrew@mccreath.vip",
            "approved",
          ]
        );

        inserted++;
        console.log(`  ✓ ${eventName}`);
      } catch (err) {
        console.warn(`  ✗ ${record["Event Name"]}: ${err.message}`);
        failed++;
      }
    }

    console.log(`\n✅ Ingestion complete: ${inserted} inserted, ${failed} failed`);
    await pool.end();
  } catch (error) {
    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      console.warn("⚠️  Database not available, skipping ingestion");
    } else {
      console.error("❌ Ingestion failed:", error.message);
    }
    process.exit(0);
  }
}

// Parse DD/MM/YYYY with optional HH:MM time
function parseDate(dateStr, timeStr) {
  if (!dateStr?.trim()) return null;
  const parts = dateStr.trim().split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  const time = timeStr?.trim() || "00:00";
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${time}:00`;
  const date = new Date(iso);
  return isNaN(date.getTime()) ? null : date;
}

ingestEvents();
