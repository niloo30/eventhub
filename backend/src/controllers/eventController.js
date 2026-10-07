import Event from "../models/Event.js";
import Registration from "../models/Registration.js";
import {
  indexEvent,
  removeEvent,
  searchEvents,
} from "../services/search.js";
import { storeUploadedImage } from "../utils/upload.js";

function isAdmin(user) {
  return user?.role === "admin";
}

function isOrganizerViewingOwnEvents(user, organizerId) {
  return user?.role === "organizer" && organizerId && organizerId === user.id;
}

function canViewUnapprovedEvent(user, event) {
  if (!user || !event) return false;
  if (isAdmin(user)) return true;

  const organizerId =
    typeof event.organizer === "object" && event.organizer?._id
      ? event.organizer._id.toString()
      : String(event.organizer);

  return user.id === organizerId;
}

function buildEventFilter(query, user) {
  const { category, status, organizer } = query;
  const filter = {};

  if (category) filter.category = category;
  if (organizer) filter.organizer = organizer;

  const canSeeAllStatuses =
    isAdmin(user) || isOrganizerViewingOwnEvents(user, organizer);

  if (canSeeAllStatuses) {
    if (status) filter.status = status;
  } else {
    filter.status = "approved";
  }

  return filter;
}

function buildEventPayload(body, user) {
  let ticketOptions = body?.ticketOptions;
  if (typeof ticketOptions === "string") {
    try {
      ticketOptions = JSON.parse(ticketOptions);
    } catch {
      ticketOptions = [];
    }
  }

  if (!Array.isArray(ticketOptions)) {
    ticketOptions = [];
  }

  const normalizedTicketOptions = ticketOptions
    .map((option, index) => {
      const keySource = String(option?.key || option?.label || `ticket-${index + 1}`)
        .trim()
        .toLowerCase();
      const key = keySource.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `ticket-${index + 1}`;
      const label = String(option?.label || option?.name || "").trim();
      const price = Number(option?.price ?? 0);
      const capacity = Number(option?.capacity ?? 0);

      if (!label) return null;

      return {
        key,
        label,
        description: String(option?.description || "").trim(),
        price: Number.isFinite(price) && price >= 0 ? price : 0,
        capacity: Number.isFinite(capacity) && capacity >= 0 ? capacity : 0,
        active: option?.active !== false,
        featured: Boolean(option?.featured),
      };
    })
    .filter(Boolean);

  const payload = {
    title: body?.title,
    description: body?.description,
    category: body?.category,
    date: body?.date,
    location: body?.location,
    capacity: Number.isFinite(Number(body?.capacity)) ? Math.max(0, Number(body?.capacity)) : 0,
    permanentBookingPrice: Number.isFinite(Number(body?.permanentBookingPrice))
      ? Math.max(0, Number(body?.permanentBookingPrice))
      : 0,
    ticketOptions: normalizedTicketOptions,
    currency: body?.currency,
    tags: body?.tags,
    posterUrl: body?.posterUrl,
  };

  if (isAdmin(user) && body?.status) {
    payload.status = body.status;
  }

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );
}

export const createEvent = async (req, res) => {
  try {
    const uploadedPoster = req.file
      ? await storeUploadedImage(req.file, { folder: "events" })
      : null;
    const posterUrl = uploadedPoster?.url || req.body?.posterUrl || null;
    const payload = buildEventPayload(req.body, req.user);
    const event = await Event.create({
      ...payload,
      organizer: req.user.id,
      posterUrl,
      status: isAdmin(req.user) ? payload.status || "approved" : "pending",
      sentForApprovalAt: isAdmin(req.user) ? undefined : new Date(),
    });

    // attempt to index into ElasticSearch (no-op if not configured)
    try {
      await indexEvent(event);
    } catch (e) {
      // swallow indexing errors
    }

    res.status(201).json({
      event,
      message: isAdmin(req.user)
        ? "Event created successfully."
        : "Event submitted for admin approval. It will stay hidden from customers until an admin approves it.",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateEvent = async (req, res) => {
  try {
    const uploadedPoster = req.file
      ? await storeUploadedImage(req.file, { folder: "events" })
      : null;
    const posterUrl = uploadedPoster?.url || req.body?.posterUrl || null;
    const update = buildEventPayload(req.body, req.user);
    if (posterUrl) update.posterUrl = posterUrl;
    const filter =
      req.user.role === "admin"
        ? { _id: req.params.id }
        : { _id: req.params.id, organizer: req.user.id };
    const existingEvent = await Event.findOne(filter);
    if (!existingEvent)
      return res.status(404).json({ message: "Event not found" });

    if (!isAdmin(req.user)) {
      update.status = "pending";
      update.sentForApprovalAt = new Date();
    }

    const event = await Event.findByIdAndUpdate(existingEvent._id, update, {
      new: true,
    });
    if (!event) return res.status(404).json({ message: "Event not found" });
    try {
      await indexEvent(event);
    } catch (e) {
      // ignore
    }
    res.json({
      event,
      message: isAdmin(req.user)
        ? "Event updated successfully."
        : existingEvent.status === "approved"
          ? "Event changes were sent for admin approval. The event is hidden from customers until it is approved again."
          : "Event updated successfully and kept in the admin approval queue.",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteEvent = async (req, res) => {
  try {
    const filter =
      req.user.role === "admin"
        ? { _id: req.params.id }
        : { _id: req.params.id, organizer: req.user.id };
    const event = await Event.findOneAndDelete(filter);
    if (!event) return res.status(404).json({ message: "Event not found" });
    try {
      await removeEvent(event._id);
    } catch (e) {
      // ignore
    }
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const listEvents = async (req, res) => {
  try {
    const { q, ...restQuery } = req.query;
    const filter = buildEventFilter(restQuery, req.user);
    const queryText = String(q || "").trim();

    if (queryText) {
      const searchResults = await searchEvents(queryText, 100);
      if (Array.isArray(searchResults) && searchResults.length > 0) {
        const orderedIds = searchResults.map((hit) => String(hit._id));
        const docs = await Event.find({
          ...filter,
          _id: { $in: orderedIds },
        }).populate("organizer", "name");
        const docsById = new Map(
          docs.map((doc) => [String(doc._id), doc]),
        );
        const events = orderedIds
          .map((id) => docsById.get(id))
          .filter(Boolean);

        return res.json({ events });
      }

      filter.title = { $regex: queryText, $options: "i" };
    }

    const events = await Event.find(filter)
      .populate("organizer", "name")
      .sort({ date: 1 });
    res.json({ events });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate(
      "organizer",
      "name",
    );
    if (!event) return res.status(404).json({ message: "Not found" });
    if (
      event.status !== "approved" &&
      !canViewUnapprovedEvent(req.user, event)
    ) {
      return res.status(404).json({ message: "Event not found" });
    }
    const count = await Registration.countDocuments({
      event: event._id,
      status: { $in: ["registered", "attended"] },
    });

    const activeRegistrations = await Registration.find({
      event: event._id,
      status: { $in: ["pending_payment", "registered", "attended"] },
    })
      .select("ticketOptionKey")
      .lean();

    const ticketAvailability = (Array.isArray(event.ticketOptions) ? event.ticketOptions : []).reduce(
      (accumulator, option) => {
        const key = String(option?.key || "").trim().toLowerCase();
        if (!key) return accumulator;

        const registered = activeRegistrations.filter(
          (registration) => String(registration.ticketOptionKey || "").toLowerCase() === key,
        ).length;

        accumulator[key] = {
          total: Number(option.capacity || 0),
          booked: registered,
          remaining: Number(option.capacity || 0) > 0 ? Math.max(0, Number(option.capacity || 0) - registered) : null,
        };
        return accumulator;
      },
      {},
    );

    res.json({
      event,
      registrations: count,
      ticketAvailability,
      totalActiveRegistrations: activeRegistrations.length,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
