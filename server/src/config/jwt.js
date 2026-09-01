module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'eventhub-super-secret-jwt-key-2026',
  JWT_EXPIRES_IN: '24h',
  HOLDING_WINDOW_MINUTES: 15 // Reservations older than 15 mins without confirmation expire
};
