export function expandSeatLayout(sections) {
  return sections.flatMap((section) =>
    section.rows.flatMap((rowLabel) =>
      Array.from({ length: section.seatsPerRow }, (_unused, index) => ({
        seatId: `${rowLabel}${index + 1}`,
        row: rowLabel,
        number: index + 1,
        section: section.name,
        price: section.price,
      }))
    )
  );
}

function buildSequentialRowLabels(count, startIndex = 0) {
  if (startIndex + count > 26) {
    const error = new Error("Seat layout supports up to 26 rows in total.");
    error.status = 400;
    throw error;
  }

  return Array.from({ length: count }, (_unused, index) =>
    String.fromCharCode(65 + startIndex + index),
  );
}

export function buildSeatSectionsFromLayout(sectionConfigs = []) {
  let rowCursor = 0;

  return sectionConfigs.map((section) => {
    const rows = Number(section.rows);
    const seatsPerRow = Number(section.seatsPerRow);
    const price = Number(section.price);

    if (!Number.isInteger(rows) || rows < 1) {
      const error = new Error(`${section.name} rows must be at least 1.`);
      error.status = 400;
      throw error;
    }

    if (!Number.isInteger(seatsPerRow) || seatsPerRow < 1) {
      const error = new Error(
        `${section.name} seats per row must be at least 1.`,
      );
      error.status = 400;
      throw error;
    }

    if (!Number.isFinite(price) || price <= 0) {
      const error = new Error(`${section.name} price must be greater than 0.`);
      error.status = 400;
      throw error;
    }

    const rowLabels = buildSequentialRowLabels(rows, rowCursor);
    rowCursor += rows;

    return {
      name: section.name,
      rows: rowLabels,
      seatsPerRow,
      price,
    };
  });
}

export function getPriceRange(seats = []) {
  if (!seats.length) return { min: 0, max: 0 };

  const prices = seats.map((seat) => seat.price);
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
}
