import Event from "../models/Event.js";
import Movie from "../models/Movie.js";
import Registration from "../models/Registration.js";
import Screen from "../models/Screen.js";
import Seat from "../models/Seat.js";
import Show from "../models/Show.js";
import Theater from "../models/Theater.js";
import TicketSeatReservation from "../models/TicketSeatReservation.js";
import TicketBooking from "../models/TicketBooking.js";
import User from "../models/User.js";
import {
  createMovieShowCatalogEntry,
  ensureTicketShowsSeeded,
} from "../services/ticketCatalog.js";
import INDIA_CITIES from "../config/indiaCities.js";
import {
  findHydratedTicketShowById,
  listHydratedTicketShows,
} from "../services/ticketing.js";
import { expandSeatLayout } from "../utils/ticketSeats.js";
import {
  buildMovieSeatColumns,
  buildScreenSeatSectionsFromMovieLayout,
  MOVIE_SEAT_LAYOUT_DEFAULTS,
  normalizeMovieSeatLayout,
  normalizeMovieSeatLayoutSignature,
  summarizeMovieSeatLayoutFromSeats,
} from "../utils/movieSeatLayout.js";
import { storeUploadedImage } from "../utils/upload.js";
import { createCatalogId } from "../utils/catalogIds.js";

const ACTIVE_REGISTRATION_STATUSES = ["registered", "attended"];

const defaultDashboardSummary = {
  events: 0,
  approvedEvents: 0,
  registrations: 0,
  customers: 0,
  organizers: 0,
};

function createBadRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parsePositiveInteger(value, fieldLabel, fallbackValue) {
  if (value === undefined || value === null || value === "") {
    return fallbackValue;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw createBadRequest(
      `${fieldLabel} must be a whole number greater than 0.`,
    );
  }

  return parsed;
}

function parseDecimal(value, fieldLabel, fallbackValue, { min = 0, max } = {}) {
  if (value === undefined || value === null || value === "") {
    return fallbackValue;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw createBadRequest(`${fieldLabel} must be a valid number.`);
  }
  if (parsed < min) {
    throw createBadRequest(`${fieldLabel} must be at least ${min}.`);
  }
  if (max !== undefined && parsed > max) {
    throw createBadRequest(`${fieldLabel} must be at most ${max}.`);
  }

  return parsed;
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;

  return ["true", "1", "on", "yes"].includes(
    String(value || "")
      .trim()
      .toLowerCase(),
  );
}

function parseTags(value) {
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getSeatLayoutRequestValue(body, fieldName, legacyFieldName) {
  const nextValue = body?.[fieldName];
  if (nextValue !== undefined && nextValue !== null && nextValue !== "") {
    return nextValue;
  }

  return body?.[legacyFieldName];
}

function buildMovieSeatLayoutFromRequest(body) {
  const nextLayout = normalizeMovieSeatLayout(
    MOVIE_SEAT_LAYOUT_DEFAULTS.map((sectionDefaults, index) => {
      const sectionNumber = index + 1;
      const legacyPrefix = ["royal", "premier", "standard"][index];

      return {
        name:
          normalizeText(
            getSeatLayoutRequestValue(
              body,
              `${sectionDefaults.key}Name`,
              `${legacyPrefix}Name`,
            ),
          ) || sectionDefaults.name,
        rows: parsePositiveInteger(
          getSeatLayoutRequestValue(
            body,
            `${sectionDefaults.key}Rows`,
            `${legacyPrefix}Rows`,
          ),
          `Section ${sectionNumber} rows`,
          sectionDefaults.rows,
        ),
        seatsPerRow: parsePositiveInteger(
          getSeatLayoutRequestValue(
            body,
            `${sectionDefaults.key}SeatsPerRow`,
            `${legacyPrefix}SeatsPerRow`,
          ),
          `Section ${sectionNumber} seats per row`,
          sectionDefaults.seatsPerRow,
        ),
        price: parsePositiveInteger(
          getSeatLayoutRequestValue(
            body,
            `${sectionDefaults.key}Price`,
            `${legacyPrefix}Price`,
          ),
          `Section ${sectionNumber} price`,
          sectionDefaults.price,
        ),
      };
    }),
  );

  const uniqueNames = new Set(
    nextLayout.map((section) => section.name.trim().toLowerCase()),
  );
  if (uniqueNames.size !== nextLayout.length) {
    throw createBadRequest("Section names must be unique.");
  }

  return nextLayout;
}

async function loadRegistrationUsers() {
  const registrations = await Registration.find({
    status: { $in: ACTIVE_REGISTRATION_STATUSES },
  })
    .populate("user", "name email")
    .populate("event", "title")
    .sort({ createdAt: -1 })
    .lean();

  const usersById = new Map();

  for (const registration of registrations) {
    const userId = registration.user?._id?.toString();
    if (!userId) continue;

    const existing = usersById.get(userId) || {
      _id: userId,
      name: registration.user?.name,
      email: registration.user?.email,
      registrations: 0,
      events: [],
      eventIds: new Set(),
    };

    existing.registrations += 1;

    const eventId = registration.event?._id?.toString();
    if (
      eventId &&
      registration.event?.title &&
      !existing.eventIds.has(`event:${eventId}`)
    ) {
      existing.eventIds.add(`event:${eventId}`);
      existing.events.push({
        _id: eventId,
        title: registration.event.title,
      });
    }

    usersById.set(userId, existing);
  }

  // Include movie ticket bookings (count paid bookings as registrations)
  try {
    const bookings = await TicketBooking.find({ status: "paid" })
      .populate("user", "name email")
      .populate("show")
      .sort({ createdAt: -1 })
      .lean();

    const movieIds = [
      ...new Set(bookings.map((b) => b.show?.movie_id).filter(Boolean)),
    ];

    const moviesById = new Map();
    if (movieIds.length > 0) {
      const movies = await Movie.find({ movie_id: { $in: movieIds } })
        .select("movie_id title")
        .lean();
      for (const m of movies) {
        moviesById.set(String(m.movie_id), m.title);
      }
    }

    for (const booking of bookings) {
      const userId = booking.user?._id?.toString();
      if (!userId) continue;

      const existing = usersById.get(userId) || {
        _id: userId,
        name: booking.user?.name,
        email: booking.user?.email,
        registrations: 0,
        events: [],
        eventIds: new Set(),
      };

      existing.registrations += 1;

      const movieId = booking.show?.movie_id;
      const movieTitle =
        moviesById.get(String(movieId)) ||
        booking.show?.title ||
        "Movie booking";
      const movieKey = `movie:${movieId || booking._id}`;

      if (movieId && !existing.eventIds.has(movieKey)) {
        existing.eventIds.add(movieKey);
        existing.events.push({
          _id: movieKey,
          title: movieTitle,
        });
      }

      usersById.set(userId, existing);
    }
  } catch (err) {
    console.error("Failed to load ticket booking users:", err.message || err);
  }

  return [...usersById.values()]
    .map(({ eventIds, ...entry }) => entry)
    .sort((left, right) => {
      if (right.registrations !== left.registrations) {
        return right.registrations - left.registrations;
      }

      return (left.name || "").localeCompare(right.name || "");
    });
}

async function loadActiveUsers() {
  return User.find({
    role: { $in: ["customer", "organizer"] },
    isBlocked: false,
  })
    .select("name email")
    .sort({ name: 1, email: 1 })
    .lean();
}

async function loadPendingEvents() {
  return Event.find({ status: "pending" })
    .populate("organizer", "name email")
    .sort({ createdAt: -1 })
    .lean();
}

async function loadDashboardSummary() {
  const [
    totalEvents,
    approvedEvents,
    totalRegistrations,
    paidTicketBookings,
    totalCustomers,
    totalOrganizers,
  ] = await Promise.all([
    Event.countDocuments({}),
    Event.countDocuments({ status: "approved" }),
    Registration.countDocuments({
      status: { $in: ACTIVE_REGISTRATION_STATUSES },
    }),
    TicketBooking.countDocuments({ status: "paid" }),
    User.countDocuments({ role: "customer", isBlocked: false }),
    User.countDocuments({ role: "organizer", isBlocked: false }),
  ]);

  return {
    events: totalEvents,
    approvedEvents,
    registrations: (totalRegistrations || 0) + (paidTicketBookings || 0),
    customers: totalCustomers,
    organizers: totalOrganizers,
  };
}

async function loadMovieShows() {
  await ensureTicketShowsSeeded();

  const shows = await listHydratedTicketShows();
  const uniqueShows = [];
  const seenTitles = new Set();

  for (const show of shows) {
    const titleKey = (show.movie_id || show.title || "").trim().toLowerCase();
    if (!titleKey || seenTitles.has(titleKey)) continue;

    seenTitles.add(titleKey);
    uniqueShows.push(show);
  }

  return uniqueShows;
}

export const getAdminDashboard = async (_req, res) => {
  try {
    const [pendingEventsResult, summaryResult, movieShowsResult] =
      await Promise.allSettled([
        loadPendingEvents(),
        loadDashboardSummary(),
        loadMovieShows(),
      ]);

    const warnings = [];

    const pendingEvents =
      pendingEventsResult.status === "fulfilled"
        ? pendingEventsResult.value
        : [];
    if (pendingEventsResult.status === "rejected") {
      warnings.push("Pending events could not be loaded.");
    }

    const summary =
      summaryResult.status === "fulfilled"
        ? summaryResult.value
        : defaultDashboardSummary;
    if (summaryResult.status === "rejected") {
      warnings.push("Platform summary could not be loaded.");
    }

    const movieShows =
      movieShowsResult.status === "fulfilled" ? movieShowsResult.value : [];
    if (movieShowsResult.status === "rejected") {
      warnings.push("Movie poster library could not be loaded.");
    }

    if (warnings.length === 3) {
      return res
        .status(500)
        .json({ message: "Unable to load the admin dashboard." });
    }

    // Enrich movieShows with booking counts and revenue per show
    try {
      const showIds = movieShows.map((s) => s._id).filter(Boolean);
      if (showIds.length > 0) {
        const bookings = await TicketBooking.find({
          show: { $in: showIds },
          status: "paid",
        }).lean();
        const bookingsByShow = new Map();
        for (const b of bookings) {
          const key = String(b.show);
          const list = bookingsByShow.get(key) || [];
          list.push(b);
          bookingsByShow.set(key, list);
        }

        for (const show of movieShows) {
          const list = bookingsByShow.get(String(show._id)) || [];
          const uniqueUsers = new Set(list.map((x) => String(x.user)));
          const revenue = list.reduce((s, x) => s + Number(x.amount || 0), 0);
          show._meta = show._meta || {};
          show._meta.bookedUsers = uniqueUsers.size;
          show._meta.paidBookings = list.length;
          show._meta.revenue = revenue;
        }
      }
    } catch (err) {
      // don't block dashboard on movie stats failure
      console.error(
        "Failed to compute movie booking stats:",
        err.message || err,
      );
    }

    res.json({ pendingEvents, summary, movieShows, warnings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getAdminAnalytics = async (_req, res) => {
  try {
    // Event registrations
    const registrations = await Registration.find({
      status: { $in: ACTIVE_REGISTRATION_STATUSES },
    })
      .populate("event", "title")
      .lean();

    const eventMap = new Map();
    for (const r of registrations) {
      const eventObj = r.event || {};
      const eventId = eventObj._id ? String(eventObj._id) : String(r.event);
      const title = eventObj.title || "Untitled Event";
      const entry = eventMap.get(eventId) || {
        id: eventId,
        title,
        registrations: 0,
        uniqueUsers: new Set(),
        revenue: 0,
      };
      entry.registrations += 1;
      if (r.user) entry.uniqueUsers.add(String(r.user));
      entry.revenue += Number(r.amount || 0);
      eventMap.set(eventId, entry);
    }

    const eventStats = [...eventMap.values()].map((e) => ({
      id: e.id,
      title: e.title,
      registrations: e.registrations,
      uniqueUsers: e.uniqueUsers.size,
      revenue: e.revenue,
    }));

    // Movie ticket bookings
    const paidBookings = await TicketBooking.find({ status: "paid" }).lean();
    const showIds = [
      ...new Set(paidBookings.map((b) => String(b.show))),
    ].filter(Boolean);
    const shows = showIds.length
      ? await Show.find({ _id: { $in: showIds } }).lean()
      : [];
    const showById = new Map(shows.map((s) => [String(s._id), s]));
    const movieIds = [...new Set(shows.map((s) => s.movie_id).filter(Boolean))];
    const movies = movieIds.length
      ? await Movie.find({ movie_id: { $in: movieIds } }).lean()
      : [];
    const moviesById = new Map(movies.map((m) => [String(m.movie_id), m]));

    const movieMap = new Map();
    for (const b of paidBookings) {
      const show = showById.get(String(b.show));
      const movieId = show?.movie_id || "unknown";
      const title =
        moviesById.get(String(movieId))?.title ||
        show?.title ||
        "Untitled Movie";
      const entry = movieMap.get(movieId) || {
        id: movieId,
        title,
        paidBookings: 0,
        uniqueUsers: new Set(),
        revenue: 0,
      };
      entry.paidBookings += 1;
      if (b.user) entry.uniqueUsers.add(String(b.user));
      entry.revenue += Number(b.amount || 0);
      movieMap.set(movieId, entry);
    }

    const movieStats = [...movieMap.values()].map((m) => ({
      id: m.id,
      title: m.title,
      paidBookings: m.paidBookings,
      uniqueUsers: m.uniqueUsers.size,
      revenue: m.revenue,
    }));

    const totals = {
      totalEventRevenue: eventStats.reduce((s, e) => s + e.revenue, 0),
      totalMovieRevenue: movieStats.reduce((s, m) => s + m.revenue, 0),
      totalRevenue:
        eventStats.reduce((s, e) => s + e.revenue, 0) +
        movieStats.reduce((s, m) => s + m.revenue, 0),
      totalEventRegistrations: eventStats.reduce(
        (s, e) => s + e.registrations,
        0,
      ),
      totalPaidBookings: movieStats.reduce((s, m) => s + m.paidBookings, 0),
    };

    res.json({ eventStats, movieStats, totals });
  } catch (err) {
    console.error("Failed to compute admin analytics:", err);
    res.status(500).json({ message: "Unable to compute analytics." });
  }
};

export const listAdminUsers = async (req, res) => {
  try {
    const scope = req.query.scope;

    if (scope === "registrations") {
      const users = await loadRegistrationUsers();
      return res.json({
        users,
        scope,
        title: "Registration Participants",
        description: "Participants and the events they are registered for.",
      });
    }

    if (scope === "active") {
      const users = await loadActiveUsers();
      return res.json({
        users,
        scope,
        title: "Active Users",
        description: "Customers and organizers who currently have access.",
      });
    }

    return res.status(400).json({ message: "Invalid user list scope." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createAdminMovieShow = async (req, res) => {
  try {
    const title = normalizeText(req.body.title);
    const genre = normalizeText(req.body.genre) || "General";
    const subtitle = normalizeText(req.body.subtitle);
    const description = normalizeText(req.body.description);
    const venue = normalizeText(req.body.venue);
    const city = normalizeText(req.body.city);
    const screenName = normalizeText(req.body.screenName) || `${title} Screen`;
    const language = normalizeText(req.body.language);
    const rating = parseDecimal(req.body.rating, "Rating", 0, {
      min: 0,
      max: 10,
    });
    const currency =
      normalizeText(req.body.currency || "INR").toUpperCase() || "INR";
    const showDate = req.body.date ? new Date(req.body.date) : null;

    if (!title) throw createBadRequest("Movie title is required.");
    if (!description) throw createBadRequest("Movie description is required.");
    if (!venue) throw createBadRequest("Venue is required.");
    if (!city) throw createBadRequest("City is required.");
    if (!showDate || Number.isNaN(showDate.getTime())) {
      throw createBadRequest("A valid show date and time is required.");
    }
    if (showDate.getTime() <= Date.now()) {
      throw createBadRequest("Show date and time must be in the future.");
    }

    const durationMinutes = parsePositiveInteger(
      req.body.durationMinutes,
      "Duration",
      150,
    );
    const seatLayout = buildMovieSeatLayoutFromRequest(req.body);

    const uploadedPoster = req.file
      ? await storeUploadedImage(req.file, { folder: "ticket-shows" })
      : null;
    const featured = parseBoolean(req.body.featured);

    if (city === "ALL_CITIES") {
      // Roll out the same show across all configured Indian cities
      const createdShows = [];
      for (const targetCity of INDIA_CITIES) {
        const s = await createMovieShowCatalogEntry({
          title,
          genre,
          rating,
          subtitle,
          description,
          venue,
          city: targetCity,
          date: showDate,
          duration: durationMinutes,
          currency,
          posterUrl: uploadedPoster?.url,
          language,
          featured,
          tags: parseTags(req.body.tags),
          screenName,
          seatLayout,
        });
        createdShows.push(s);
      }

      const hydratedShows = await Promise.all(
        createdShows.map((s) => findHydratedTicketShowById(s._id)),
      );

      res.status(201).json({
        message: `${title} was added to ${hydratedShows.length} cities.`,
        shows: hydratedShows,
      });
    } else {
      const show = await createMovieShowCatalogEntry({
        title,
        genre,
        rating,
        subtitle,
        description,
        venue,
        city,
        date: showDate,
        duration: durationMinutes,
        currency,
        posterUrl: uploadedPoster?.url,
        language,
        featured,
        tags: parseTags(req.body.tags),
        screenName,
        seatLayout,
      });

      const hydratedShow = await findHydratedTicketShowById(show._id);

      res.status(201).json({
        message: `${title} was added to the movies page.`,
        show: hydratedShow,
      });
    }
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

export const updateAdminMovieShow = async (req, res) => {
  try {
    await ensureTicketShowsSeeded();

    const sourceShow = await findHydratedTicketShowById(req.params.id);
    if (!sourceShow) {
      return res.status(404).json({ message: "Movie show not found." });
    }

    const title = normalizeText(req.body.title);
    const genre = normalizeText(req.body.genre) || "General";
    const subtitle = normalizeText(req.body.subtitle);
    const description = normalizeText(req.body.description);
    const venue = normalizeText(req.body.venue);
    const city = normalizeText(req.body.city);
    const screenName =
      normalizeText(req.body.screenName) ||
      sourceShow.screen?.name ||
      `${title} Screen`;
    const language = normalizeText(req.body.language);
    const rating = parseDecimal(
      req.body.rating,
      "Rating",
      sourceShow.rating || 0,
      {
        min: 0,
        max: 10,
      },
    );
    const currency =
      normalizeText(
        req.body.currency || sourceShow.currency || "INR",
      ).toUpperCase() || "INR";
    const showDate = req.body.date
      ? new Date(req.body.date)
      : new Date(sourceShow.date);

    if (!title) throw createBadRequest("Movie title is required.");
    if (!description) throw createBadRequest("Movie description is required.");
    if (!venue) throw createBadRequest("Venue is required.");
    if (!city) throw createBadRequest("City is required.");
    if (!showDate || Number.isNaN(showDate.getTime())) {
      throw createBadRequest("A valid show date and time is required.");
    }

    const durationMinutes = parsePositiveInteger(
      req.body.durationMinutes,
      "Duration",
      sourceShow.durationMinutes || 150,
    );
    const seatLayout = buildMovieSeatLayoutFromRequest(req.body);
    const nextSeatSignature = normalizeMovieSeatLayoutSignature(seatLayout);
    const currentSeatSignature = normalizeMovieSeatLayoutSignature(
      sourceShow.movie?.seatLayout?.length
        ? sourceShow.movie.seatLayout
        : summarizeMovieSeatLayoutFromSeats(sourceShow.seats || []),
    );

    const uploadedPoster = req.file
      ? await storeUploadedImage(req.file, { folder: "ticket-shows" })
      : null;
    const featured = parseBoolean(req.body.featured);
    const tags = parseTags(req.body.tags);

    await Movie.updateOne(
      { movie_id: sourceShow.movie_id },
      {
        title,
        genre,
        subtitle,
        description,
        duration: durationMinutes,
        rating,
        language,
        tags,
        ...buildMovieSeatColumns(seatLayout),
        ...(uploadedPoster?.url ? { posterUrl: uploadedPoster.url } : {}),
      },
    );

    await Theater.updateOne(
      { theater_id: sourceShow.theater?.theater_id },
      { name: venue, city },
    );

    await Screen.updateOne(
      { screen_id: sourceShow.screen_id },
      { name: screenName },
    );

    if (nextSeatSignature !== currentSeatSignature) {
      const screenSeatSections =
        buildScreenSeatSectionsFromMovieLayout(seatLayout);
      const siblingShows = await Show.find({ screen_id: sourceShow.screen_id })
        .select("_id")
        .lean();
      const siblingShowIds = siblingShows.map((show) => show._id);
      const reservationCount = await TicketSeatReservation.countDocuments({
        show: { $in: siblingShowIds },
      });

      if (reservationCount > 0) {
        throw createBadRequest(
          "Seat layout cannot be changed because this screen already has active or confirmed bookings.",
        );
      }

      await Seat.deleteMany({ screen_id: sourceShow.screen_id });
      await Seat.insertMany(
        expandSeatLayout(screenSeatSections).map((seat) => ({
          seat_id: createCatalogId("SET"),
          screen_id: sourceShow.screen_id,
          label: seat.seatId,
          row: seat.row,
          number: seat.number,
          section: seat.section,
          price: seat.price,
        })),
      );
    }

    if (featured) {
      await Show.updateMany(
        { featured: true, _id: { $ne: sourceShow._id } },
        { featured: false },
      );
    }

    await Show.updateOne(
      { _id: sourceShow._id },
      {
        date: showDate,
        currency,
        featured,
      },
    );

    const hydratedShow = await findHydratedTicketShowById(sourceShow._id);

    res.json({
      message: `${title} was updated successfully.`,
      show: hydratedShow,
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

export const approveEvent = async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { status: "approved", sentForApprovalAt: undefined },
      { new: true },
    );
    if (!event) return res.status(404).json({ message: "Not found" });
    res.json({
      event,
      message: "Event approved successfully. It is now visible to customers.",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const rejectEvent = async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { status: "rejected", sentForApprovalAt: undefined },
      { new: true },
    );
    if (!event) return res.status(404).json({ message: "Not found" });
    res.json({
      event,
      message: "Event request declined. It stays hidden from customers.",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const listPendingEvents = async (req, res) => {
  try {
    const events = await loadPendingEvents();
    res.json({ events });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const blockUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBlocked: true },
      { new: true },
    );
    if (!user) return res.status(404).json({ message: "Not found" });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBlocked: false },
      { new: true },
    );
    if (!user) return res.status(404).json({ message: "Not found" });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
