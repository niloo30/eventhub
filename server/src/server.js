const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const db = require('./db/database');
const { checkAndExpireReservations } = require('./services/expiryService');

// Route Imports
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const sessionRoutes = require('./routes/sessions');
const registrationRoutes = require('./routes/registrations');
const staffRoutes = require('./routes/staff');
const bulkRoutes = require('./routes/bulk');
const dashboardRoutes = require('./routes/dashboard');
const alertRoutes = require('./routes/alerts');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Background Worker: Run auto-expiry check every 60 seconds
setInterval(() => {
  try {
    checkAndExpireReservations();
  } catch (err) {
    console.error('Background expiry worker error:', err);
  }
}, 60 * 1000);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/bulk', bulkRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/alerts', alertRoutes);

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` 🚀 EventHub Backend Server running on port ${PORT}`);
  console.log(` 📅 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(` 🔐 Holding Window Expiry Worker Active (15 Mins)`);
  console.log(`=======================================================`);
});
