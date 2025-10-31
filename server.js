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
// const analyticsRoutes = require("./routes/analyticsRoutes");

// Initialize reminder scheduler
require("./Utils/reminderScheduler");

// Connect to database
database.connect();

// Middleware setup - UPDATED FOR IMAGE UPLOADS
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cookieParser());

// CORS configuration - UPDATED FOR BETTER COMPATIBILITY
// Update your CORS configuration
// app.use(
//   cors({
//     origin: "https://www.fittracker.in",
//     credentials: true,
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
//     allowedHeaders: [
//       'Content-Type',
//       'Authorization',
//       'Cache-Control',
//       'Pragma',
//       'Expires'
//     ]
//   })
// );

// ✅ Updated CORS configuration (priority: fittracker.in, fallback: localhost)
const allowedOrigins = [
  "https://www.fittracker.in",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5174",
];

const corsOptions = {
  origin: (origin, callback) => {
    // ✅ Allow requests from your live domain or same-origin (no origin)
    if (!origin || origin === "https://www.fittracker.in") {
      return callback(null, true);
    }

    // ✅ Allow local development URLs
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // ❌ Block everything else
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
  ],
};

app.use(cors(corsOptions));

const {
  initializeSlotCronJobs,
} = require("./Basic/Features/Crwodmanage/Controllers/slotController");
initializeSlotCronJobs();

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Route setup
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/member", memberRoutes);
app.use("/api/v1/owner", ownerRoutes);
app.use("/api/v1/payment", paymentRoutes);
app.use("/api/v1/subscription", subscriptionRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/v1", contactRoutes);
app.use(
  "/api/v1/analytics",
  require("./Basic/Features/MemberCrud/Routes/analyticsRoutes")
);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Contact form: http://localhost:${PORT}/api/v1/contact`);
  console.log("All routes loaded successfully");
  console.log("Image upload limit: 10MB");
});

module.exports = app;
