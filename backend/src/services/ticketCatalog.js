import Movie from "../models/Movie.js";
import Screen from "../models/Screen.js";
import Seat from "../models/Seat.js";
import Show from "../models/Show.js";
import Theater from "../models/Theater.js";
import TicketBooking from "../models/TicketBooking.js";
import TicketSeatReservation from "../models/TicketSeatReservation.js";
import LegacyTicketShow from "../models/TicketShow.js";
import { createCatalogId } from "../utils/catalogIds.js";
import { expandSeatLayout } from "../utils/ticketSeats.js";
import {
  buildMovieSeatColumns,
  buildScreenSeatSectionsFromMovieLayout,
  normalizeMovieSeatLayout,
  summarizeMovieSeatLayoutFromSeats,
} from "../utils/movieSeatLayout.js";
import { listHydratedTicketShows } from "./ticketing.js";

function buildTicketSeedData() {
  const now = Date.now();

  return [
    {
      title: "Midnight Multiverse",
      genre: "Sci-Fi",
      duration: 148,
      rating: 8.4,
      subtitle: "Sci-fi premiere screening",
      description:
        "A multiverse action film with immersive surround sound and recliner seating.",
      venue: "Galaxy Cinemas",
      city: "Delhi",
      screenName: "Aurora Screen",
      date: new Date(now + 2 * 24 * 60 * 60 * 1000 + 19 * 60 * 60 * 1000),
      language: "English",
      featured: true,
      tags: ["3D", "Premiere"],
      seatSections: [
        { name: "Royal", rows: ["A", "B"], seatsPerRow: 8, price: 420 },
        { name: "Prime", rows: ["C", "D"], seatsPerRow: 10, price: 280 },
        { name: "Classic", rows: ["E", "F"], seatsPerRow: 10, price: 180 },
      ],
    },
    {
      title: "Crimson Cipher",
      genre: "Thriller",
      duration: 132,
      rating: 7.8,
      subtitle: "Mystery thriller night show",
      description:
        "A detective thriller with immersive Dolby sound and a late-night city vibe.",
      venue: "Metro Screens",
      city: "Mumbai",
      screenName: "Noir Screen",
      date: new Date(now + 4 * 24 * 60 * 60 * 1000 + 21 * 60 * 60 * 1000),
      language: "Hindi",
      tags: ["Thriller"],
      seatSections: [
        { name: "Royal", rows: ["A", "B"], seatsPerRow: 7, price: 360 },
        { name: "Premier", rows: ["C", "D", "E"], seatsPerRow: 9, price: 230 },
        { name: "Standard", rows: ["F", "G"], seatsPerRow: 10, price: 160 },
      ],
    },
  ];
}

function escapeRegExp(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compareRowLabels(left = "", right = "") {
  return String(left).localeCompare(String(right), "en", {
    numeric: true,
  });
}

function findSeatSectionConfigs(seats = []) {
  const sections = new Map();

  for (const seat of [...seats].sort((left, right) => {
    const rowComparison = compareRowLabels(left.row, right.row);
    if (rowComparison !== 0) return rowComparison;
    if (left.number !== right.number) return left.number - right.number;
    return String(left.section || "").localeCompare(
      String(right.section || ""),
    );
  })) {
    const current = sections.get(seat.section) || {
      name: seat.section,
      price: seat.price,
      rows: new Map(),
    };

    const rowSeats = current.rows.get(seat.row) || [];
    rowSeats.push(seat);
    current.rows.set(seat.row, rowSeats);
    sections.set(seat.section, current);
  }

  return [...sections.values()].map((section) => ({
    name: section.name,
    rows: [...section.rows.keys()].sort(),
    seatsPerRow: Math.max(
      ...[...section.rows.values()].map((rowSeats) => rowSeats.length),
    ),
    price: section.price,
  }));
}

async function ensureMovieRecord(payload) {
  const movie =
    (await Movie.findOne({
      title: { $regex: `^${escapeRegExp(payload.title)}$`, $options: "i" },
    })) || new Movie({ title: payload.title });

  movie.genre = payload.genre || movie.genre || "General";
  movie.duration = payload.duration || movie.duration || 150;
  movie.rating = payload.rating ?? movie.rating ?? 0;
  movie.subtitle = payload.subtitle || movie.subtitle || "";
  movie.description = payload.description || movie.description || "";
  movie.posterUrl = payload.posterUrl || movie.posterUrl;
  movie.language = payload.language || movie.language || "";
  movie.tags = [...new Set([...(movie.tags || []), ...(payload.tags || [])])];
  if (payload.seatLayout?.length) {
    Object.assign(movie, buildMovieSeatColumns(payload.seatLayout));
  }

  await movie.save();
  return movie;
}

async function ensureTheaterRecord({ name, city }) {
  const theater =
    (await Theater.findOne({
      name,
      city,
    })) || new Theater({ name, city });

  theater.name = name;
  theater.city = city;
  await theater.save();

  return theater;
}

async function ensureScreenRecord({ theater, screenName }) {
  const screen =
    (await Screen.findOne({
      theater_id: theater.theater_id,
      name: screenName,
    })) ||
    new Screen({
      theater_id: theater.theater_id,
      name: screenName,
    });

  screen.theater_id = theater.theater_id;
  screen.name = screenName;
  await screen.save();

  return screen;
}

async function ensureSeatsForScreen(screen, seatSections) {
  const existingSeats = await Seat.countDocuments({
    screen_id: screen.screen_id,
  });
  if (existingSeats > 0) return;

  const expandedSeats = expandSeatLayout(seatSections);
  if (!expandedSeats.length) return;

  await Seat.insertMany(
    expandedSeats.map((seat) => ({
      seat_id: createCatalogId("SET"),
      screen_id: screen.screen_id,
      label: seat.seatId,
      row: seat.row,
      number: seat.number,
      section: seat.section,
      price: seat.price,
    })),
  );
}

async function createShowRecord({
  movie,
  screen,
  date,
  currency = "INR",
  featured = false,
}) {
  const existingShow = await Show.findOne({
    movie_id: movie.movie_id,
    screen_id: screen.screen_id,
    date,
  });

  if (existingShow) {
    existingShow.currency = currency || existingShow.currency;
    existingShow.featured = featured;
    await existingShow.save();
    try {
      // index updated show
      const { indexShow } = await import("./search.js");
      await indexShow(existingShow);
    } catch (e) {
      // ignore
    }
    return existingShow;
  }

  const created = await Show.create({
    movie_id: movie.movie_id,
    screen_id: screen.screen_id,
    date,
    currency,
    featured,
  });

  try {
    const { indexShow } = await import("./search.js");
    await indexShow({
      ...created.toObject(),
      title: movie.title,
      venue: screen.name,
      city: screen && screen.theater_id ? undefined : undefined,
      posterUrl: movie.posterUrl || null,
      language: movie.language,
      tags: movie.tags || [],
    });
  } catch (e) {
    // ignore
  }

  return created;
}

export async function createMovieShowCatalogEntry({
  title,
  genre = "General",
  duration = 150,
  rating = 0,
  subtitle = "",
  description,
  venue,
  city,
  date,
  currency = "INR",
  posterUrl,
  language = "",
  featured = false,
  tags = [],
  screenName,
  seatLayout = [],
  seatSections = [],
}) {
  const normalizedSeatLayout = seatLayout.length
    ? normalizeMovieSeatLayout(seatLayout)
    : normalizeMovieSeatLayout(
        summarizeMovieSeatLayoutFromSeats(expandSeatLayout(seatSections)),
      );
  const screenSeatSections = seatSections.length
    ? seatSections
    : buildScreenSeatSectionsFromMovieLayout(normalizedSeatLayout);

  const movie = await ensureMovieRecord({
    title,
    genre,
    duration,
    rating,
    subtitle,
    description,
    posterUrl,
    language,
    tags,
    seatLayout: normalizedSeatLayout,
  });

  const theater = await ensureTheaterRecord({ name: venue, city });
  const screen = await ensureScreenRecord({
    theater,
    screenName: screenName || `${title} Screen`,
  });
  await ensureSeatsForScreen(screen, screenSeatSections);

  if (featured) {
    await Show.updateMany({ featured: true }, { featured: false });
  }

  return createShowRecord({
    movie,
    screen,
    date,
    currency,
    featured,
  });
}

function buildShiftedDate(baseDate, days, hours) {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + days);
  nextDate.setTime(nextDate.getTime() + hours * 60 * 60 * 1000);
  return nextDate;
}

function hasNearbySession(existingShows, candidateDate) {
  return existingShows.some(
    (show) =>
      Math.abs(new Date(show.date).getTime() - candidateDate.getTime()) <
      20 * 60 * 1000,
  );
}

function buildMovieSessionVariants(show) {
  const offsets = [
    { days: 0, hours: -3 },
    { days: 0, hours: 3 },
    { days: 1, hours: -2 },
    { days: 1, hours: 2 },
    { days: 2, hours: -1 },
    { days: 3, hours: 1 },
    { days: 4, hours: 0 },
  ];

  return offsets.map((offset) => ({
    movie_id: show.movie_id,
    screen_id: show.screen_id,
    date: buildShiftedDate(show.date, offset.days, offset.hours),
    currency: show.currency,
    featured: false,
  }));
}

async function ensureMovieShowtimeVariants(existingShows) {
  const movieGroups = new Map();

  for (const show of existingShows) {
    const groupKey = `${show.movie_id}::${show.screen_id}`;
    const list = movieGroups.get(groupKey) || [];
    list.push(show);
    movieGroups.set(groupKey, list);
  }

  const inserts = [];

  for (const group of movieGroups.values()) {
    if (group.length >= 8) continue;

    group.sort((left, right) => new Date(left.date) - new Date(right.date));
    const anchorShow = group[0];
    const variants = buildMovieSessionVariants(anchorShow);

    for (const variant of variants) {
      if (group.length >= 8) break;
      if (variant.date.getTime() <= Date.now()) continue;
      if (hasNearbySession(group, variant.date)) continue;

      inserts.push(variant);
      group.push({ ...anchorShow, date: variant.date });
    }
  }

  if (inserts.length > 0) {
    await Show.insertMany(inserts);
  }
}

async function migrateLegacyTicketShows() {
  const legacyShows = await LegacyTicketShow.find({ type: "movie" })
    .sort({ date: 1 })
    .lean();
  if (!legacyShows.length) return;

  const showIdMap = new Map();

  for (const legacyShow of legacyShows) {
    const migratedShow = await createMovieShowCatalogEntry({
      title: legacyShow.title,
      genre: "General",
      duration: legacyShow.durationMinutes,
      rating: 0,
      subtitle: legacyShow.subtitle,
      description: legacyShow.description,
      venue: legacyShow.venue,
      city: legacyShow.city,
      date: legacyShow.date,
      currency: legacyShow.currency,
      posterUrl: legacyShow.posterUrl,
      language: legacyShow.language,
      featured: legacyShow.featured,
      tags: legacyShow.tags || [],
      screenName: `${legacyShow.title} Screen`,
      seatSections: findSeatSectionConfigs(legacyShow.seats || []),
    });

    showIdMap.set(String(legacyShow._id), migratedShow._id);
  }

  for (const [legacyShowId, migratedShowId] of showIdMap.entries()) {
    await TicketBooking.updateMany(
      { show: legacyShowId },
      { show: migratedShowId },
    );
    await TicketSeatReservation.updateMany(
      { show: legacyShowId },
      { show: migratedShowId },
    );
  }
}

export async function ensureTicketShowsSeeded() {
  let existingShowsCount = await Show.countDocuments();

  if (!existingShowsCount) {
    await migrateLegacyTicketShows();
    existingShowsCount = await Show.countDocuments();
  }

  if (!existingShowsCount) {
    for (const entry of buildTicketSeedData()) {
      await createMovieShowCatalogEntry(entry);
    }
  }

  const existingShows = await listHydratedTicketShows();
  await ensureMovieShowtimeVariants(existingShows);
}
