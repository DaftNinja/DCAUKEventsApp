import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { db } from './db/index.js';
import { events } from './db/schema.js';

/**
 * Usage: node src/scripts/ingest-events.js dca-events.csv
 * 
 * Expected CSV columns:
 * - title
 * - description
 * - start_date (ISO format: 2024-01-15T09:00:00Z)
 * - end_date (ISO format, optional)
 * - location
 * - is_virtual (true/false)
 * - event_url
 */

async function ingestEvents(filePath) {
  if (!filePath) {
    console.error('Please provide a CSV file path');
    console.error('Usage: node src/scripts/ingest-events.js <csv-file>');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  try {
    console.log(`Reading events from ${filePath}...`);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
    });

    console.log(`Found ${records.length} events to ingest`);

    let inserted = 0;
    let failed = 0;

    for (const record of records) {
      try {
        // Validate required fields
        if (!record.title || !record.start_date) {
          console.warn(`Skipping row: missing title or start_date`);
          failed++;
          continue;
        }

        await db.insert(events).values({
          title: record.title.trim(),
          description: record.description ? record.description.trim() : null,
          startDate: new Date(record.start_date),
          endDate: record.end_date ? new Date(record.end_date) : null,
          location: record.location ? record.location.trim() : null,
          isVirtual: record.is_virtual === 'true' || record.is_virtual === '1' ? true : false,
          organiser: record.organiser ? record.organiser.trim() : 'DCA',
          eventUrl: record.event_url ? record.event_url.trim() : null,
        });

        inserted++;
      } catch (error) {
        console.error(`Failed to insert event: ${record.title}`, error.message);
        failed++;
      }
    }

    console.log(`✓ Ingestion complete: ${inserted} inserted, ${failed} failed`);
    process.exit(0);
  } catch (error) {
    console.error('Ingestion failed:', error.message);
    process.exit(1);
  }
}

const filePath = process.argv[2];
ingestEvents(filePath);
