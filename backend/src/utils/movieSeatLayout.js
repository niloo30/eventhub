import { buildSeatSectionsFromLayout } from "./ticketSeats.js";

export const MOVIE_SEAT_LAYOUT_DEFAULTS = [
  {
    key: "section1",
    name: "Section 1",
    rows: 2,
    seatsPerRow: 7,
    price: 360,
  },
  {
    key: "section2",
    name: "Section 2",
    rows: 3,
    seatsPerRow: 9,
    price: 230,
  },
  {
    key: "section3",
    name: "Section 3",
    rows: 2,
    seatsPerRow: 10,
    price: 160,
  },
];

function toPositiveInteger(value, fallbackValue) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallbackValue;
}

function normalizeSectionName(value, fallbackValue) {
  return typeof value === "string" && value.trim() ? value.trim() : fallbackValue;
}

function compareRowLabels(left = "", right = "") {
  return String(left).localeCompare(String(right), "en", {
    numeric: true,
  });
}

export function normalizeMovieSeatLayout(layout = []) {
  return MOVIE_SEAT_LAYOUT_DEFAULTS.map((defaults, index) => {
    const candidate = layout[index] || {};
    const rows = toPositiveInteger(candidate.rows, defaults.rows);
    const seatsPerRow = toPositiveInteger(
      candidate.seatsPerRow,
      defaults.seatsPerRow,
    );

    return {
      key: defaults.key,
      order: index + 1,
      name: normalizeSectionName(candidate.name, defaults.name),
      rows,
      seatsPerRow,
      price: toPositiveInteger(candidate.price, defaults.price),
      totalSeats: rows * seatsPerRow,
    };
  });
}

export function buildMovieSeatColumns(layout = []) {
  const normalizedLayout = normalizeMovieSeatLayout(layout);
  const [section1, section2, section3] = normalizedLayout;

  return {
    seatLayout: normalizedLayout,
    section1Seats: section1?.totalSeats || 0,
    section2Seats: section2?.totalSeats || 0,
    section3Seats: section3?.totalSeats || 0,
  };
}

export function buildScreenSeatSectionsFromMovieLayout(layout = []) {
  const normalizedLayout = normalizeMovieSeatLayout(layout);

  return buildSeatSectionsFromLayout(
    [...normalizedLayout].reverse().map((section) => ({
      name: section.name,
      rows: section.rows,
      seatsPerRow: section.seatsPerRow,
      price: section.price,
    })),
  );
}

export function summarizeMovieSeatLayoutFromSeats(seats = []) {
  const sections = new Map();

  for (const seat of [...seats].sort((left, right) => {
    const rowComparison = compareRowLabels(left.row, right.row);
    if (rowComparison !== 0) return rowComparison;
    if (left.number !== right.number) return left.number - right.number;
    return String(left.section || "").localeCompare(String(right.section || ""));
  })) {
    const current =
      sections.get(seat.section) ||
      {
        name: seat.section,
        price: seat.price,
        rows: new Map(),
      };

    const rowSeats = current.rows.get(seat.row) || [];
    rowSeats.push(seat);
    current.rows.set(seat.row, rowSeats);
    sections.set(seat.section, current);
  }

  return [...sections.values()].map((section, index) => {
    const seatsPerRow = Math.max(
      0,
      ...[...section.rows.values()].map((rowSeats) => rowSeats.length),
    );

    return {
      key: MOVIE_SEAT_LAYOUT_DEFAULTS[index]?.key || `section${index + 1}`,
      order: index + 1,
      name: section.name,
      rows: section.rows.size,
      seatsPerRow,
      price: Number(section.price) || 0,
      totalSeats: section.rows.size * seatsPerRow,
    };
  });
}

export function normalizeMovieSeatLayoutSignature(layout = []) {
  return JSON.stringify(
    normalizeMovieSeatLayout(layout).map((section) => ({
      key: section.key,
      name: section.name,
      rows: section.rows,
      seatsPerRow: section.seatsPerRow,
      price: section.price,
    })),
  );
}
