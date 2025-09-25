// const express = require("express");
// const { body, validationResult } = require("express-validator");
// const {
//   initiatePayment,
//   verifyPayment,
//   getSubscriptionPlans,
//   getSubscriptionStatus,
//   webhookHandler
// } = require("../controllers/paymentController");

// // Import middleware
// const { auth } = require("../middleware/authMiddleware");
// const { checkSubscriptionExpiry } = require("../middleware/subscriptionMiddleware");

// const router = express.Router();

// // Public routes (no auth required)

// // Get all subscription plans
// router.get("/plans", getSubscriptionPlans);

// // Webhook endpoint for Razorpay (should be public, no auth)
// router.post("/webhook", webhookHandler);

// // Protected routes (auth required)

// // Get user's current subscription status
// router.get("/status", auth, checkSubscriptionExpiry, getSubscriptionStatus);

// // Initiate payment process
// router.post(
//   "/initiate",
//   [
//     // Validation middleware
//     body("plan")
//       .notEmpty()
//       .withMessage("Subscription plan is required")
//       .isIn(["BASIC"]) // Currently only BASIC available
//       .withMessage("Invalid subscription plan. Currently only BASIC plan is available"),
//     body("billing")
//       .optional()
//       .isIn(["monthly", "yearly"])
//       .withMessage("Invalid billing cycle. Must be 'monthly' or 'yearly'")
//   ],
//   // Validation error handler
//   (req, res, next) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).json({
//         success: false,
//         message: "Validation failed",
//         errors: errors.array()
//       });
//     }
//     next();
//   },
//   // Auth middleware (ensures user is logged in)
//   auth,
//   // Check and update subscription expiry
//   checkSubscriptionExpiry,
//   // Controller function
//   initiatePayment
// );

// // Verify payment after successful payment
// router.post(
//   "/verify",
//   [
//     // Validation middleware
//     body("razorpay_payment_id")
//       .notEmpty()
//       .withMessage("Payment ID is required"),
//     body("razorpay_order_id")
//       .notEmpty()
//       .withMessage("Order ID is required"),
//     body("razorpay_signature")
//       .notEmpty()
//       .withMessage("Payment signature is required")
//   ],
//   // Validation error handler
//   (req, res, next) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).json({
//         success: false,
//         message: "Payment verification failed",
//         errors: errors.array()
//       });
//     }
//     next();
//   },
//   // Auth middleware
//   auth,
//   // Controller function
//   verifyPayment
// );

// module.exports = router;

const express = require("express");
const { body, validationResult } = require("express-validator");

console.log("🔍 [DEBUG] PaymentRoutes: Starting to load payment routes...");

// Debug: Test if controller file exists
let paymentController;
try {
  paymentController = require("../Controllers/paymentController");
  console.log("✅ [DEBUG] PaymentRoutes: Payment controller file loaded successfully");
  console.log("📋 [DEBUG] PaymentRoutes: Available exports:", Object.keys(paymentController));
} catch (error) {
  console.error("❌ [DEBUG] PaymentRoutes: Failed to load payment controller:", error.message);
  console.error("❌ [DEBUG] PaymentRoutes: Full error:", error);
}

// Try to destructure imports with error handling
let initiatePayment, verifyPayment, getSubscriptionPlans, getSubscriptionStatus, webhookHandler;

try {
  ({
    initiatePayment,
    verifyPayment,
    getSubscriptionPlans,
    getSubscriptionStatus,
    webhookHandler
  } = paymentController);

  console.log("🔍 [DEBUG] PaymentRoutes: Function import status:");
  console.log("  - initiatePayment:", typeof initiatePayment);
  console.log("  - verifyPayment:", typeof verifyPayment);
  console.log("  - getSubscriptionPlans:", typeof getSubscriptionPlans);
  console.log("  - getSubscriptionStatus:", typeof getSubscriptionStatus);
  console.log("  - webhookHandler:", typeof webhookHandler);
} catch (error) {
  console.error("❌ [DEBUG] PaymentRoutes: Failed to destructure controller functions:", error.message);
}

// Import middleware with debug
let auth, checkSubscriptionExpiry;
try {
  ({ auth } = require("../../Auth/Middleware/authMiddleware"));
  console.log("✅ [DEBUG] PaymentRoutes: Auth middleware loaded:", typeof auth);
} catch (error) {
  console.error("❌ [DEBUG] PaymentRoutes: Failed to load auth middleware:", error.message);
}

try {
  ({ checkSubscriptionExpiry } = require("../../Subscription/Middleware/subscriptionMiddleware"));
  console.log("✅ [DEBUG] PaymentRoutes: Subscription middleware loaded:", typeof checkSubscriptionExpiry);
} catch (error) {
  console.error("❌ [DEBUG] PaymentRoutes: Failed to load subscription middleware:", error.message);
}

const router = express.Router();
console.log("✅ [DEBUG] PaymentRoutes: Express router created");

// Debug test route
router.get("/debug", (req, res) => {
  console.log("🎯 [DEBUG] PaymentRoutes: Debug route hit!");
  res.json({ 
    message: "Payment routes debug endpoint working!",
    timestamp: new Date().toISOString(),
    availableFunctions: {
      initiatePayment: typeof initiatePayment,
      verifyPayment: typeof verifyPayment,
      getSubscriptionPlans: typeof getSubscriptionPlans,
      getSubscriptionStatus: typeof getSubscriptionStatus,
      webhookHandler: typeof webhookHandler
    }
  });
});

// Public routes (no auth required)
console.log("🔧 [DEBUG] PaymentRoutes: Setting up public routes...");

// Get all subscription plans
if (typeof getSubscriptionPlans === 'function') {
  router.get("/plans", (req, res, next) => {
    console.log("🎯 [DEBUG] PaymentRoutes: /plans route hit");
    getSubscriptionPlans(req, res, next);
  });
  console.log("✅ [DEBUG] PaymentRoutes: /plans route registered");
} else {
  console.error("❌ [DEBUG] PaymentRoutes: getSubscriptionPlans is not a function, skipping route");
}

// Webhook endpoint for Razorpay
if (typeof webhookHandler === 'function') {
  router.post("/webhook", (req, res, next) => {
    console.log("🎯 [DEBUG] PaymentRoutes: /webhook route hit");
    webhookHandler(req, res, next);
  });
  console.log("✅ [DEBUG] PaymentRoutes: /webhook route registered");
} else {
  console.error("❌ [DEBUG] PaymentRoutes: webhookHandler is not a function, skipping route");
}

// Protected routes (auth required)
console.log("🔧 [DEBUG] PaymentRoutes: Setting up protected routes...");

// Get user's current subscription status
if (typeof getSubscriptionStatus === 'function' && typeof auth === 'function') {
  router.get("/status", 
    (req, res, next) => {
      console.log("🎯 [DEBUG] PaymentRoutes: /status route hit");
      next();
    },
    auth, 
    checkSubscriptionExpiry || ((req, res, next) => next()), 
    getSubscriptionStatus
  );
  console.log("✅ [DEBUG] PaymentRoutes: /status route registered");
} else {
  console.error("❌ [DEBUG] PaymentRoutes: getSubscriptionStatus or auth not available, skipping route");
}

// Initiate payment process
if (typeof initiatePayment === 'function' && typeof auth === 'function') {
  router.post(
    "/initiate",
    [
      body("plan")
        .notEmpty()
        .withMessage("Subscription plan is required")
        .isIn(["BASIC"])
        .withMessage("Invalid subscription plan. Currently only BASIC plan is available"),
      body("billing")
        .optional()
        .isIn(["monthly", "yearly"])
        .withMessage("Invalid billing cycle. Must be 'monthly' or 'yearly'")
    ],
    (req, res, next) => {
      console.log("🎯 [DEBUG] PaymentRoutes: /initiate route hit");
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log("❌ [DEBUG] PaymentRoutes: Validation errors:", errors.array());
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array()
        });
      }
      next();
    },
    auth,
    checkSubscriptionExpiry || ((req, res, next) => next()),
    initiatePayment
  );
  console.log("✅ [DEBUG] PaymentRoutes: /initiate route registered");
} else {
  console.error("❌ [DEBUG] PaymentRoutes: initiatePayment or auth not available, skipping route");
}

// Verify payment
if (typeof verifyPayment === 'function' && typeof auth === 'function') {
  router.post(
    "/verify",
    [
      body("razorpay_payment_id").notEmpty().withMessage("Payment ID is required"),
      body("razorpay_order_id").notEmpty().withMessage("Order ID is required"),
      body("razorpay_signature").notEmpty().withMessage("Payment signature is required")
    ],
    (req, res, next) => {
      console.log("🎯 [DEBUG] PaymentRoutes: /verify route hit");
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log("❌ [DEBUG] PaymentRoutes: Validation errors:", errors.array());
        return res.status(400).json({
          success: false,
          message: "Payment verification failed",
          errors: errors.array()
        });
      }
      next();
    },
    auth,
    verifyPayment
  );
  console.log("✅ [DEBUG] PaymentRoutes: /verify route registered");
} else {
  console.error("❌ [DEBUG] PaymentRoutes: verifyPayment or auth not available, skipping route");
}

console.log("🎉 [DEBUG] PaymentRoutes: All routes setup complete");

module.exports = router;