import { env } from "../config/env.js";

let client = null;

async function initClient() {
  if (client) return client;
  if (!env.elasticUrl) {
    console.info("ElasticSearch disabled: ELASTIC_URL not set");
    return null;
  }

  try {
    const { Client } = await import("@elastic/elasticsearch");
    client = new Client({ node: env.elasticUrl });
    // ping to verify connectivity
    await client.ping();
    console.info("ElasticSearch client initialized");
    return client;
  } catch (err) {
    console.warn(
      "ElasticSearch client not available or failed to initialize:",
      err.message || err,
    );
    client = null;
    return null;
  }
}

function buildTextQuery(text, fields) {
  const normalizedText = String(text || "").trim();
  if (!normalizedText) return null;

  return {
    multi_match: {
      query: normalizedText,
      fields,
      fuzziness: "AUTO",
      operator: "or",
      type: "best_fields",
    },
  };
}

async function searchIndex(index, text, fields, size = 50) {
  try {
    const c = await initClient();
    if (!c) return null;

    const query = buildTextQuery(text, fields);
    if (!query) return [];

    const response = await c.search({
      index,
      size,
      body: {
        query,
      },
    });

    return response.hits?.hits || [];
  } catch (err) {
    console.warn(`searchIndex(${index}) failed:`, err.message || err);
    return null;
  }
}

export async function indexEvent(event) {
  try {
    const c = await initClient();
    if (!c) return null;
    const id = String(event._id || event.id);
    await c.index({
      index: "events",
      id,
      body: {
        title: event.title,
        description: event.description,
        category: event.category,
        date: event.date,
        location: event.location,
        tags: event.tags || [],
        posterUrl: event.posterUrl || null,
        organizer: event.organizer || null,
      },
    });
    await c.indices.refresh({ index: "events" });
    return id;
  } catch (err) {
    console.warn("indexEvent failed:", err.message || err);
    return null;
  }
}

export async function removeEvent(eventId) {
  try {
    const c = await initClient();
    if (!c) return null;
    await c.delete({ index: "events", id: String(eventId) });
  } catch (err) {
    // ignore not found
  }
}

export async function indexShow(show) {
  try {
    const c = await initClient();
    if (!c) return null;
    const id = String(show._id || show.id);
    await c.index({
      index: "shows",
      id,
      body: {
        title: show.title,
        venue: show.venue || show.location || null,
        city: show.city || null,
        date: show.date,
        language: show.language || null,
        tags: show.tags || [],
        posterUrl: show.posterUrl || null,
        type: show.type || "movie",
      },
    });
    await c.indices.refresh({ index: "shows" });
    return id;
  } catch (err) {
    console.warn("indexShow failed:", err.message || err);
    return null;
  }
}

export async function removeShow(showId) {
  try {
    const c = await initClient();
    if (!c) return null;
    await c.delete({ index: "shows", id: String(showId) });
  } catch (err) {
    // ignore
  }
}

export async function searchEvents(text, size = 50) {
  return searchIndex(
    "events",
    text,
    ["title^4", "description", "category^2", "location^2", "tags^3"],
    size,
  );
}

export async function searchShows(text, size = 50) {
  return searchIndex(
    "shows",
    text,
    ["title^4", "venue^3", "city^3", "language^2", "tags^2", "type"],
    size,
  );
}

export default {
  initClient,
  indexEvent,
  removeEvent,
  indexShow,
  removeShow,
  searchEvents,
  searchShows,
};
