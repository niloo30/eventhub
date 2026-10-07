import Redis from 'ioredis';
import { env } from './env.js';

let redisClient = null;
let redisClientPromise = null;
let redisDisabled = false;
let redisErrorLogged = false;
let redisRetryAfter = 0;

const hasExplicitRedisConfig = Boolean(
  process.env.REDIS_URL ||
  process.env.REDIS_HOST ||
  process.env.REDIS_PORT ||
  process.env.REDIS_PASSWORD
);

function buildRedisOptions() {
  return {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    reconnectOnError: () => false,
    retryStrategy: () => null,
  };
}

function buildBullMqRedisOptions() {
  return {
    lazyConnect: true,
    enableOfflineQueue: true,
    maxRetriesPerRequest: null,
    connectTimeout: 3000,
    retryStrategy: (times) => Math.min(times * 50, 2000),
  };
}

function createRedisInstance() {
  if (!hasExplicitRedisConfig) {
    return null;
  }

  if (env.redisUrl) {
    return new Redis(env.redisUrl, buildRedisOptions());
  }

  return new Redis({
    ...buildRedisOptions(),
    host: env.redisHost || 'localhost',
    port: env.redisPort || 6379,
    password: env.redisPassword || undefined,
  });
}

export function createBullMqRedisOptions() {
  if (!hasExplicitRedisConfig) {
    return null;
  }

  if (env.redisUrl) {
    return {
      url: env.redisUrl,
      ...buildBullMqRedisOptions(),
    };
  }

  return {
    ...buildBullMqRedisOptions(),
    host: env.redisHost || 'localhost',
    port: env.redisPort || 6379,
    password: env.redisPassword || undefined,
  };
}

export async function getRedisClient() {
  if (!hasExplicitRedisConfig) {
    return null;
  }

  if (redisDisabled && Date.now() < redisRetryAfter) {
    return null;
  }

  if (redisDisabled && Date.now() >= redisRetryAfter) {
    redisDisabled = false;
    redisErrorLogged = false;
  }

  if (redisClient?.status === 'ready') {
    return redisClient;
  }

  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      let client = null;
      try {
        client = createRedisInstance();
        if (!client) return null;

        client.on('connect', () => {
          console.log('Redis connected');
        });

        client.on('error', (error) => {
          if (redisErrorLogged) return;
          redisErrorLogged = true;
          console.error('Redis error:', error.message);
        });

        await client.connect();
        redisClient = client;
        redisErrorLogged = false;
        return client;
      } catch (error) {
        console.warn(`Redis unavailable: ${error.message}`);
        redisDisabled = true;
        redisRetryAfter = Date.now() + 30000;
        if (client) {
          try {
            client.disconnect();
          } catch {
            // ignore
          }
        }
        redisClient = null;
        return null;
      } finally {
        redisClientPromise = null;
      }
    })();
  }

  return redisClientPromise;
}

export async function closeRedisClient() {
  if (!redisClient) return;

  try {
    await redisClient.quit();
  } catch {
    await redisClient.disconnect();
  } finally {
    redisClient = null;
  }
}

export function isRedisConfigured() {
  return hasExplicitRedisConfig;
}

export default {
  getRedisClient,
  closeRedisClient,
  isRedisConfigured,
  createBullMqRedisOptions,
};
