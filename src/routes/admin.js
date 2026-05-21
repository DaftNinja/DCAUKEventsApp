import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import csv from "csv-parse/sync";
import pg from "pg";
import { v4 as uuidv4 } from "uuid";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function ingestEvents() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log("📥 Ingesting events...");

    // Read CSV file
    const csvPath = path.join(__dirname, "../events.csv");
    const fileContent = fs.readFileSync(csvPath, "utf-8");
    const records = csv.parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
    });

    console.log(`Found ${records.length} events to ingest`);

    // Get or create Andrew's user ID
    const userResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      ["andrew@mccreath.vip"]
    );

    let organizerId;
    if (userResult.rows.length > 0) {
      organizerId = userResult.rows[0].id;
      console.log(`✓ Using existing user: ${organizerId}`);
    } else {
      // Create placeholder user for Andrew
      const newUser = await pool.query(
        `INSERT INTO users ("linkedinId", email, name, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING id`,
        ["andrew-placeholder", "andrew@mccreath.vip", "Andrew McCreath"]
      );
      organizerId = newUser.rows[0].id;
      console.log(`✓ Created new user: ${organizerId}`);
    }

    // Insert events
    let inserted = 0;
    for (const record of records) {
      try {
        const eventId = uuidv4();

        await pool.query(
          `INSERT INTO events (
            id, title, description, "startDate", "endDate", 
            location, "eventUrl", "organizerId", "organizerEmail", 
            status, "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
          [
            eventId,
            record["Event Name"] || "Untitled Event",
            record["Description"] || "",
            new Date(record["Start Date"]),
            new Date(record["End Date"]),
            record["Venue / Location"] || "TBD",
            record["URL"] || "",
            organizerId,
            "andrew@mccreath.vip",
            "approved", // Auto-approve since from trusted source
          ]
        );

        inserted++;
        console.log(`  ✓ ${record["Event Name"]}`);
      } catch (err) {
        console.warn(`  ✗ Failed to insert ${record["Event Name"]}:`, err.message);
      }
    }

    console.log(`\n✅ Ingested ${inserted}/${records.length} events`);
    await pool.end();
  } catch (error) {
    console.error("❌ Ingestion failed:", error);
    process.exit(1);
  }
}

ingestEvents();