
// const express = require("express");
// const router = express.Router();
// const { body, validationResult } = require("express-validator");
// const { submitContactForm } = require("../controllers/dashboardController");

// // Validation middleware
// const contactValidation = [
//   body("name")
//     .trim()
//     .notEmpty()
//     .withMessage("Name is required")
//     .isLength({ min: 2, max: 100 })
//     .withMessage("Name must be between 2-100 characters"),
    
//   body("email")
//     .trim()
//     .isEmail()
//     .withMessage("Please provide a valid email address")
//     .normalizeEmail(),
    
//   body("phone")
//     .optional()
//     .trim()
//     .isMobilePhone('any')
//     .withMessage("Please provide a valid phone number"),
    
//   body("subject")
//     .trim()
//     .notEmpty()
//     .withMessage("Subject is required")
//     .isLength({ min: 5, max: 200 })
//     .withMessage("Subject must be between 5-200 characters"),
    
//   body("inquiry")
//     .optional()
//     .isIn(['general', 'sales', 'support', 'demo', 'partnership'])
//     .withMessage("Invalid inquiry type"),
    
//   body("message")
//     .trim()
//     .notEmpty()
//     .withMessage("Message is required")
//     .isLength({ min: 10, max: 2000 })
//     .withMessage("Message must be between 10-2000 characters"),
    
//   body("gymName")
//     .optional()
//     .trim()
//     .isLength({ max: 100 })
//     .withMessage("Gym name must be less than 100 characters"),
    
//   body("ownerName")
//     .optional()
//     .trim()
//     .isLength({ max: 100 })
//     .withMessage("Owner name must be less than 100 characters")
// ];

// // Validation error handler middleware
// const handleValidationErrors = (req, res, next) => {
//   const errors = validationResult(req);
//   if (!errors.isEmpty()) {
//     return res.status(400).json({
//       success: false,
//       message: "Validation failed",
//       errors: errors.array()
//     });
//   }
//   next();
// };

// // Contact form route - simplified without rate limiting
// router.post(
//   "/contact",
//   contactValidation,       // Apply validation
//   handleValidationErrors,  // Handle validation errors
//   submitContactForm        // Handle the actual submission
// );

// module.exports = router;

const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const { submitContactForm } = require("../Controllers/dashboardController");

// Import auth and subscription middleware
const { auth, isOwner } = require("../../Auth/Middleware/authMiddleware");
const { isSubscribed, checkSubscriptionExpiry } = require("../../Subscription/Middleware/subscriptionMiddleware");

// Validation middleware (unchanged)
const contactValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2-100 characters"),
       
  body("email")
    .trim()
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),
       
  body("phone")
    .optional()
    .trim()
    .isMobilePhone('any')
    .withMessage("Please provide a valid phone number"),
       
  body("subject")
    .trim()
    .notEmpty()
    .withMessage("Subject is required")
    .isLength({ min: 5, max: 200 })
    .withMessage("Subject must be between 5-200 characters"),
       
  body("inquiry")
    .optional()
    .isIn(['general', 'sales', 'support', 'demo', 'partnership'])
    .withMessage("Invalid inquiry type"),
       
  body("message")
    .trim()
    .notEmpty()
    .withMessage("Message is required")
    .isLength({ min: 10, max: 2000 })
    .withMessage("Message must be between 10-2000 characters"),
       
  body("gymName")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Gym name must be less than 100 characters"),
       
  body("ownerName")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Owner name must be less than 100 characters")
];

// Validation error handler middleware (unchanged)
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array()
    });
  }
  next();
};

// ===== PUBLIC ROUTES (No subscription required) =====

// Contact form route - Public route for inquiries
router.post(
  "/contact",
  contactValidation,
  handleValidationErrors,
  submitContactForm
);

// ===== SUBSCRIPTION-PROTECTED ANALYTICS ROUTES =====

// Basic analytics - Requires subscription
// router.get("/analytics/basic",  dont uncomment this because with same in analyticsRoutes also has same path 
router.get("/dashboard/analytics-preview", 
  auth, 
  isOwner,
  checkSubscriptionExpiry,
  isSubscribed,
  (req, res) => {
    // This would be implemented in your dashboard controller
    res.json({
      success: true,
      message: "Basic analytics data",
      data: {
        totalMembers: "Available with subscription",
        dueAmount: "Available with subscription", 
        activeMembers: "Available with subscription"
      }
    });
  }
);

// Advanced analytics - Requires BASIC or higher subscription
router.get("/analytics/advanced", 
  auth, 
  isOwner,
  checkSubscriptionExpiry,
  isSubscribed,
  (req, res) => {
    const { subscriptionPlan } = req.user;
    
    if (subscriptionPlan === "BASIC") {
      res.json({
        success: true,
        message: "Advanced analytics (Basic plan)",
        data: {
          memberGrowth: "Month-over-month growth data",
          revenueAnalytics: "Basic revenue insights",
          retentionRate: "Member retention statistics"
        }
      });
    } else {
      res.json({
        success: true,
        message: "Full advanced analytics",
        data: {
          memberGrowth: "Detailed growth analytics",
          revenueAnalytics: "Advanced revenue insights",
          retentionRate: "Comprehensive retention data",
          predictiveInsights: "AI-powered predictions"
        }
      });
    }
  }
);

// Dashboard summary - Shows different content based on subscription
router.get("/dashboard/summary", 
  auth, 
  isOwner,
  checkSubscriptionExpiry,
  (req, res) => {
    const { subscriptionPlan, hasActiveSubscription } = req.user;
    
    if (subscriptionPlan === "NONE" || !hasActiveSubscription) {
      return res.json({
        success: true,
        hasAccess: false,
        message: "Subscribe to unlock your gym management dashboard",
        needsSubscription: true,
        preview: {
          message: "See what you'll get with a subscription:",
          features: [
            "Member management for up to 150 members",
            "AI-powered insights and recommendations", 
            "Automated WhatsApp payment reminders",
            "Real-time analytics and reports",
            "Due member tracking and notifications"
          ]
        },
        cta: {
          title: "Start Your Gym Journey",
          subtitle: "Perfect for small gyms and personal trainers",
          price: "₹399/month or ₹3990/year",
          savings: "Save ₹798 with yearly billing"
        }
      });
    }

    // User has active subscription - show actual dashboard data
    return res.json({
      success: true,
      hasAccess: true,
      message: `Welcome to your ${subscriptionPlan} dashboard!`,
      data: {
        plan: subscriptionPlan,
        // This would include actual dashboard data
        summary: "Dashboard data available with subscription",
        features: "All features unlocked"
      }
    });
  }
);

module.exports = router;