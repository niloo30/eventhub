import { getRedisClient } from '../config/redis.js';

function getRedisHoldKey(showId, seatId) {
  return `seat:${showId}:${seatId}`;
}

async function safeReleaseKey(client, key, lockValue) {
  if (!client) return;

  if (!lockValue) {
    await client.del(key).catch(() => {});
    return;
  }

  const releaseScript = `
    if redis.call('get', KEYS[1]) == ARGV[1] then
      return redis.call('del', KEYS[1])
    end
    return 0
  `;

  await client.eval(releaseScript, 1, key, lockValue).catch(() => {});
}

export async function acquireTicketSeatHoldLocks({
  showId,
  seatIds = [],
  lockValue,
  ttlSeconds,
}) {
  const client = await getRedisClient();
  const uniqueSeatIds = [...new Set(seatIds)].filter(Boolean).sort();
  const ttl = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : 300;

  if (!client) {
    return {
      enabled: false,
      acquiredSeatIds: [],
      conflictSeatId: null,
    };
  }

  const acquiredSeatIds = [];

  try {
    for (const seatId of uniqueSeatIds) {
      const key = getRedisHoldKey(showId, seatId);
      const result = await client.set(key, lockValue, 'EX', ttl, 'NX');
      if (result !== 'OK') {
        for (const acquiredSeatId of acquiredSeatIds) {
          await safeReleaseKey(
            client,
            getRedisHoldKey(showId, acquiredSeatId),
            lockValue,
          );
        }

        return {
          enabled: true,
          acquiredSeatIds: [],
          conflictSeatId: seatId,
        };
      }

      acquiredSeatIds.push(seatId);
    }
  } catch (error) {
    for (const acquiredSeatId of acquiredSeatIds) {
      await safeReleaseKey(
        client,
        getRedisHoldKey(showId, acquiredSeatId),
        lockValue,
      );
    }

    console.warn(`Redis seat hold acquisition failed: ${error.message}`);
    return {
      enabled: false,
      acquiredSeatIds: [],
      conflictSeatId: null,
    };
  }

  return {
    enabled: true,
    acquiredSeatIds,
    conflictSeatId: null,
  };
}

export async function releaseTicketSeatHoldLocks({
  showId,
  seatIds = [],
  lockValue,
}) {
  const client = await getRedisClient();
  if (!client) return;

  const uniqueSeatIds = [...new Set(seatIds)].filter(Boolean);
  for (const seatId of uniqueSeatIds) {
    await safeReleaseKey(
      client,
      getRedisHoldKey(showId, seatId),
      lockValue,
    );
  }
}

export async function releaseTicketSeatHoldLocksForBooking(booking) {
  if (!booking?.show || !booking?.seats?.length) return;

  await releaseTicketSeatHoldLocks({
    showId: String(booking.show),
    seatIds: booking.seats.map((seat) => seat.seatId),
    lockValue: booking.bookingReference || String(booking._id),
  });
}
