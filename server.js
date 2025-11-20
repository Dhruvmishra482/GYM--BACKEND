const express = require("express");
const app = express();
const database = require("./config/db");
const cookieParser = require("cookie-parser");
const cors = require("cors");
require("dotenv").config();

// Route imports
const authRoutes = require("./Basic/Features/Auth/Routes/authRoutes");
const memberRoutes = require("./Basic/Features/MemberCrud/Routes/memberRoutes");
const ownerRoutes = require("./Basic/Features/MyProfile/Routes/ownerProfileRoutes");
const contactRoutes = require("./Basic/Features/MemberCrud/Routes/dashboardRoutes");
const paymentRoutes = require("./Basic/Features/Payment/Routes/paymentRoutes");
const subscriptionRoutes = require("./Basic/Features/Subscription/Routes/subscriptionRoutes");
const dietPlanRoutes = require("./Advance/Features/AiDietPlan/Routes/dietPlanRoutes");
const workoutPlanRoutes = require("./Advance/Features/Aiworkout/routes/workoutRoutes");
// const announcementRoutes = require("./Advance/Features/BulkAnnouncement/Routes/announcementRoutes");
// const analyticsRoutes = require("./routes/analyticsRoutes");

// Initialize reminder scheduler
require("./Utils/reminderScheduler");

// Connect to database
database.connect();

// Middleware setup - UPDATED FOR IMAGE UPLOADS
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cookieParser());

// ========================================
// CORS CONFIGURATION - PRODUCTION READY
// ========================================
const allowedOrigins = [
  "https://www.fittracker.in",
  "https://fittracker.in",
  // "http://localhost:5173",
  // "http://localhost:3000",
  // "http://localhost:5174",
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Allow production domain
    if (
      origin === "https://www.fittracker.in" ||
      origin === "https://fittracker.in"
    ) {
      return callback(null, true);
    }

    // Allow local development URLs
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Log blocked origins for debugging
    console.warn(`⚠️ CORS blocked origin: ${origin}`);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Cache-Control",
    "Pragma",
    "Expires",
    "X-Requested-With",
  ],
  exposedHeaders: ["set-cookie"],
  maxAge: 86400, // 24 hours - cache preflight requests
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

// Apply CORS middleware globally
app.use(cors(corsOptions));

// ✅ FIXED: Handle preflight requests for all routes
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS, PATCH"
    );
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Cache-Control, Pragma, Expires, X-Requested-With"
    );
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Max-Age", "86400");
    return res.status(204).end();
  }
  next();
});

// Initialize slot cron jobs
const {
  initializeSlotCronJobs,
} = require("./Basic/Features/Crwodmanage/Controllers/slotController");
initializeSlotCronJobs();

// ========================================
// HEALTH CHECK ENDPOINT
// ========================================
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

// ========================================
// API ROUTES
// ========================================
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/member", memberRoutes);
app.use("/api/v1/owner", ownerRoutes);
app.use("/api/v1/payment", paymentRoutes);
app.use("/api/v1/subscription", subscriptionRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/v1", contactRoutes);
app.use("/api/v1/diet-plan", dietPlanRoutes);
app.use("/api/v1/workout-plan", workoutPlanRoutes);
app.use(
  "/api/v1/analytics",
  require("./Basic/Features/MemberCrud/Routes/analyticsRoutes")
);

// ========================================
// ERROR HANDLING MIDDLEWARE
// ========================================

// 404 Handler - Route not found
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    path: req.originalUrl,
    method: req.method,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Global Error Handler:", {
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    path: req.originalUrl,
    method: req.method,
  });

  // CORS error
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "CORS policy: Origin not allowed",
      origin: req.headers.origin,
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// ========================================
// START SERVER
// ========================================
const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log("========================================");
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`📧 Contact form: http://localhost:${PORT}/api/v1/contact`);
  console.log("========================================");
  console.log("📋 Loaded Routes:");
  console.log("   - /api/v1/auth");
  console.log("   - /api/v1/member");
  console.log("   - /api/v1/owner");
  console.log("   - /api/v1/payment");
  console.log("   - /api/v1/subscription");
  console.log("   - /api/v1/analytics");
  console.log("   - /api/v1/diet-plan");
  console.log("   - /api/v1/workout-plan");
  console.log("========================================");
  console.log("⚙️  Configurations:");
  console.log("   - Image upload limit: 10MB");
  console.log("   - CORS: Enabled for fittracker.in");
  console.log("   - Credentials: Enabled");
  console.log("========================================");
  console.log("📅 Scheduled Jobs:");
  console.log("   - Daily due member reminders: 12:00 AM");
  console.log("   - Daily billing cycle reset: 2:00 AM");
  console.log("   - Weekly member count sync: Sunday 3:00 AM");
  console.log("   - Daily expiry reminders: 9:00 AM");
  console.log("   - Hourly health check");
  console.log("========================================");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("⚠️  SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("✅ HTTP server closed");
    database.disconnect();
  });
});

process.on("SIGINT", () => {
  console.log("⚠️  SIGINT signal received: closing HTTP server");
  server.close(() => {
    console.log("✅ HTTP server closed");
    database.disconnect();
  });
});

module.exports = app;
