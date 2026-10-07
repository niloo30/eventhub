#!/usr/bin/env node
import { connectDB } from "../src/config/db.js";
import Event from "../src/models/Event.js";
import Show from "../src/models/Show.js";
import { listHydratedTicketShows } from "../src/services/ticketing.js";
import { indexEvent, indexShow } from "../src/services/search.js";

async function run() {
  try {
    await connectDB();
    console.log("Connected to DB. Starting bulk indexing...");

    // Index events
    const events = await Event.find({}).lean();
    console.log(`Found ${events.length} events. Indexing...`);
    let evCount = 0;
    for (const ev of events) {
      try {
        await indexEvent(ev);
        evCount++;
      } catch (e) {
        console.warn(`Failed to index event ${ev._id}:`, e.message || e);
      }
    }
    console.log(`Events indexed: ${evCount}/${events.length}`);

    // Index shows (use hydrated shows so we include movie/poster data)
    const hydratedShows = await listHydratedTicketShows();
    console.log(`Found ${hydratedShows.length} shows. Indexing...`);
    let showCount = 0;
    for (const sh of hydratedShows) {
      try {
        await indexShow(sh);
        showCount++;
      } catch (e) {
        console.warn(`Failed to index show ${sh._id}:`, e.message || e);
      }
    }
    console.log(`Shows indexed: ${showCount}/${hydratedShows.length}`);

    console.log("Bulk indexing complete.");
    process.exit(0);
  } catch (err) {
    console.error("Bulk indexing failed:", err);
    process.exit(1);
  }
}

run();
