import crypto from "crypto";
import Movie from "../models/Movie.js";
import Screen from "../models/Screen.js";
import Seat from "../models/Seat.js";
import Show from "../models/Show.js";
import Theater from "../models/Theater.js";
import TicketBooking from "../models/TicketBooking.js";
import TicketSeatReservation from "../models/TicketSeatReservation.js";
import { env } from "../config/env.js";
import { getRedisClient } from "../config/redis.js";
import {
  acquireTicketSeatHoldLocks,
  releaseTicketSeatHoldLocks,
  releaseTicketSeatHoldLocksForBooking,
} from "./ticketRedis.js";
import { emitTicketSeatMap } from "./socket.js";
import { getPriceRange } from "../utils/ticketSeats.js";

const ACTIVE_UNPAID_STATUSES = ["held", "pending_payment"];
const SHOW_SNAPSHOT_TTL_SECONDS = 10;
const showSnapshotMemoryCache = new Map();

function toPlain(document) {
  return document?.toObject ? document.toObject() : document;
}

function mapSeats(seats = []) {
  return seats.map((seat) => ({
    seat_id: seat.seat_id,
    seatId: seat.label,
    row: seat.row,
    number: seat.number,
    section: seat.section,
    price: seat.price,
  }));
}

export function getTicketHoldDurationMs() {
  return env.ticketHoldMinutes * 60 * 1000;
}

export function generateTicketBookingReference() {
  return `TKT-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
}

export async function hydrateTicketShows(showDocs = []) {
  const plainShows = showDocs.map(toPlain).filter(Boolean);
  if (!plainShows.length) return [];

  const movieIds = [...new Set(plainShows.map((show) => show.movie_id).filter(Boolean))];
  const screenIds = [...new Set(plainShows.map((show) => show.screen_id).filter(Boolean))];

  const [movies, screens, seats] = await Promise.all([
    Movie.find({ movie_id: { $in: movieIds } }).lean(),
    Screen.find({ screen_id: { $in: screenIds } }).lean(),
    Seat.find({ screen_id: { $in: screenIds } }).sort({ row: 1, number: 1 }).lean(),
  ]);

  const moviesById = new Map(movies.map((movie) => [movie.movie_id, movie]));
  const screensById = new Map(screens.map((screen) => [screen.screen_id, screen]));
  const theaterIds = [...new Set(screens.map((screen) => screen.theater_id).filter(Boolean))];
  const theaters = await Theater.find({ theater_id: { $in: theaterIds } }).lean();
  const theatersById = new Map(theaters.map((theater) => [theater.theater_id, theater]));

  const seatsByScreenId = new Map();
  for (const seat of seats) {
    const list = seatsByScreenId.get(seat.screen_id) || [];
    list.push(seat);
    seatsByScreenId.set(seat.screen_id, list);
  }

  return plainShows
    .map((show) => {
      const movie = moviesById.get(show.movie_id);
      const screen = screensById.get(show.screen_id);
      const theater = screen ? theatersById.get(screen.theater_id) : null;

      if (!movie || !screen || !theater) return null;

      return {
        ...show,
        type: "movie",
        title: movie.title,
        genre: movie.genre,
        subtitle: movie.subtitle,
        description: movie.description,
        venue: theater.name,
        city: theater.city,
        durationMinutes: movie.duration,
        posterUrl: movie.posterUrl,
        language: movie.language,
        rating: movie.rating,
        tags: movie.tags || [],
        seatLayout: movie.seatLayout || [],
        section1Seats: movie.section1Seats || 0,
        section2Seats: movie.section2Seats || 0,
        section3Seats: movie.section3Seats || 0,
        seats: mapSeats(seatsByScreenId.get(show.screen_id) || []),
        movie,
        screen,
        theater,
      };
    })
    .filter(Boolean);
}

export async function listHydratedTicketShows(filter = {}, sort = { date: 1 }) {
  const shows = await Show.find(filter).sort(sort);
  return hydrateTicketShows(shows);
}

export async function findHydratedTicketShowById(showId) {
  const show = await Show.findById(showId);
  if (!show) return null;

  const [hydratedShow] = await hydrateTicketShows([show]);
  return hydratedShow || null;
}

export function mapTicketShowSummary(show, counters) {
  const pricing = getPriceRange(show.seats);

  return {
    _id: show._id,
    show_id: show.show_id,
    movie_id: show.movie_id,
    screen_id: show.screen_id,
    type: show.type || "movie",
    title: show.title,
    genre: show.genre,
    subtitle: show.subtitle,
    description: show.description,
    venue: show.venue,
    city: show.city,
    date: show.date,
    durationMinutes: show.durationMinutes,
    currency: show.currency,
    posterUrl: show.posterUrl,
    featured: show.featured,
    language: show.language,
    rating: show.rating,
    tags: show.tags,
    seatLayout: show.seatLayout || [],
    section1Seats: show.section1Seats || 0,
    section2Seats: show.section2Seats || 0,
    section3Seats: show.section3Seats || 0,
    pricing,
    counters,
    totalSeats: show.seats.length,
  };
}

export function buildSeatSnapshot(show, reservations) {
  const reservationMap = new Map(
    reservations.map((reservation) => [reservation.seatId, reservation]),
  );
  const counters = {
    total: show.seats.length,
    available: 0,
    held: 0,
    booked: 0,
  };

  const seats = show.seats.map((seat) => {
    const reservation = reservationMap.get(seat.seatId);
    let status = "available";

    if (reservation) {
      status = reservation.status === "booked" ? "booked" : "held";
    }

    counters[status] += 1;

    return {
      ...seat,
      status,
      holdExpiresAt: status === "held" ? reservation.holdExpiresAt : null,
      bookingId: reservation?.booking ? String(reservation.booking) : null,
    };
  });

  return { counters, seats };
}

function getShowSnapshotCacheKey(showId) {
  return `snapshot:${showId}`;
}

function setMemoryShowSnapshot(showId, payload) {
  showSnapshotMemoryCache.set(getShowSnapshotCacheKey(showId), {
    value: payload,
    expiresAt: Date.now() + SHOW_SNAPSHOT_TTL_SECONDS * 1000,
  });
}

function getMemoryShowSnapshot(showId) {
  const key = getShowSnapshotCacheKey(showId);
  const entry = showSnapshotMemoryCache.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    showSnapshotMemoryCache.delete(key);
    return null;
  }

  return entry.value;
}

async function readRedisShowSnapshot(showId) {
  const client = await getRedisClient();
  if (!client) return null;

  try {
    const cached = await client.get(getShowSnapshotCacheKey(showId));
    if (!cached) return null;

    const parsed = JSON.parse(cached);
    setMemoryShowSnapshot(showId, parsed);
    return parsed;
  } catch (error) {
    console.warn(`Failed to read ticket show snapshot cache: ${error.message}`);
    return null;
  }
}

async function writeRedisShowSnapshot(showId, payload) {
  const client = await getRedisClient();
  if (!client) return;

  try {
    await client.setex(
      getShowSnapshotCacheKey(showId),
      SHOW_SNAPSHOT_TTL_SECONDS,
      JSON.stringify(payload),
    );
  } catch (error) {
    console.warn(`Failed to cache ticket show snapshot: ${error.message}`);
  }
}

async function clearRedisShowSnapshot(showId) {
  const client = await getRedisClient();
  if (!client) return;

  try {
    await client.del(getShowSnapshotCacheKey(showId));
  } catch (error) {
    console.warn(`Failed to clear ticket show snapshot cache: ${error.message}`);
  }
}

export async function invalidateShowCache(showId) {
  if (!showId) return;

  showSnapshotMemoryCache.delete(getShowSnapshotCacheKey(showId));
  await clearRedisShowSnapshot(showId);
}

async function cacheTicketShowState(showId, payload) {
  if (!showId || !payload) return payload;

  setMemoryShowSnapshot(showId, payload);
  await writeRedisShowSnapshot(showId, payload);
  return payload;
}

export async function getShowSnapshot(showId) {
  if (!showId) return null;

  await cleanupExpiredTicketHolds(showId);

  const cached = getMemoryShowSnapshot(showId) || (await readRedisShowSnapshot(showId));
  if (cached) return cached;

  const show = await findHydratedTicketShowById(showId);
  if (!show) return null;

  const reservations = await TicketSeatReservation.find({ show: showId });
  const seatSnapshot = buildSeatSnapshot(show, reservations);
  return cacheTicketShowState(showId, {
    show: mapTicketShowSummary(show, seatSnapshot.counters),
    seatSnapshot,
  });
}

export async function lockSeats(showId, seatIds, lockValue, ttlSeconds) {
  return acquireTicketSeatHoldLocks({ showId, seatIds, lockValue, ttlSeconds });
}

export async function releaseSeats(showId, seatIds, lockValue) {
  return releaseTicketSeatHoldLocks({ showId, seatIds, lockValue });
}

export async function cleanupExpiredTicketHolds(showId = null) {
  const now = new Date();
  const filter = {
    status: { $in: ACTIVE_UNPAID_STATUSES },
    holdExpiresAt: { $lte: now },
  };

  if (showId) filter.show = showId;

  const expiredBookings = await TicketBooking.find(filter).select("_id show seats bookingReference");
  if (!expiredBookings.length) return [];

  const bookingIds = expiredBookings.map((booking) => booking._id);
  const affectedShowIds = [
    ...new Set(expiredBookings.map((booking) => String(booking.show))),
  ];

  await TicketBooking.updateMany(
    { _id: { $in: bookingIds } },
    { status: "expired" },
  );
  await TicketSeatReservation.deleteMany({
    booking: { $in: bookingIds },
    status: "held",
  });
  await Promise.all(expiredBookings.map((booking) => releaseTicketSeatHoldLocksForBooking(booking)));
  await Promise.all(affectedShowIds.map((id) => invalidateShowCache(id)));

  return affectedShowIds;
}

export async function cancelActiveBookingsForUser(showId, userId) {
  const existingBookings = await TicketBooking.find({
    show: showId,
    user: userId,
    status: { $in: ACTIVE_UNPAID_STATUSES },
  }).select("_id show seats bookingReference");

  if (!existingBookings.length) return [];

  const bookingIds = existingBookings.map((booking) => booking._id);
  const affectedShowIds = [
    ...new Set(existingBookings.map((booking) => String(booking.show))),
  ];

  await TicketBooking.updateMany(
    { _id: { $in: bookingIds } },
    { status: "cancelled" },
  );
  await TicketSeatReservation.deleteMany({
    booking: { $in: bookingIds },
    status: "held",
  });
  await Promise.all(existingBookings.map((booking) => releaseTicketSeatHoldLocksForBooking(booking)));
  await Promise.all(affectedShowIds.map((id) => invalidateShowCache(id)));

  return affectedShowIds;
}

export async function getTicketShowSeatState(showId) {
  return getShowSnapshot(showId);
}

export async function broadcastTicketSeatState(showId) {
  const state = await getTicketShowSeatState(showId);
  if (!state) return;

  emitTicketSeatMap(showId, {
    showId,
    counters: state.seatSnapshot.counters,
    seats: state.seatSnapshot.seats,
    emittedAt: Date.now(),
  });
}

let cleanupIntervalId = null;

export function startTicketHoldCleanupLoop() {
  if (cleanupIntervalId) return;

  cleanupIntervalId = setInterval(async () => {
    try {
      const affectedShowIds = await cleanupExpiredTicketHolds();
      for (const showId of affectedShowIds) {
        await broadcastTicketSeatState(showId);
      }
    } catch (error) {
      console.error("Ticket hold cleanup failed:", error.message);
    }
  }, 15000);

  if (typeof cleanupIntervalId.unref === "function") {
    cleanupIntervalId.unref();
  }
}
