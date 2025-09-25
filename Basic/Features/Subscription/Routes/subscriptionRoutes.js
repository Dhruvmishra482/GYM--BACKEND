// routes/subscriptionRoutes.js - Updated with flexible billing support

const express = require("express");
const { body, validationResult } = require("express-validator");
const {
    getSubscriptionDetails,
    getPlanComparison,
    calculateUpgradePrice,
    checkUsageLimit,
    trackFeatureUsage,
    sendExpiryReminders,
    processUpgrade,
    resetCustomBillingCycles,
    getUsageAnalytics,
    updateNotificationSettings,
    syncMemberCounts
} = require("../Controllers/subscriptionController");


const { auth, isOwner } = require("../../Auth/Middleware/authMiddleware");
const { isSubscribed, checkSubscriptionExpiry } = require("../../Subscription/Middleware/subscriptionMiddleware");
const Member  = require("../../MemberCrud/Models/Member");

const router = express.Router();

// Validation middleware
const validateRequest = (validations) => {
    return async (req, res, next) => {
        await Promise.all(validations.map(validation => validation.run(req)));
        
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
};

// ===== PUBLIC ROUTES (Admin/Scheduler access) =====
router.post("/send-reminders", sendExpiryReminders);
router.post("/reset-billing-cycles", resetCustomBillingCycles);

// ===== PROTECTED ROUTES (Auth required) =====

// Get comprehensive subscription details with usage analytics
router.get("/details", 
    auth, 
    isOwner, 
    checkSubscriptionExpiry,
    getSubscriptionDetails
);

// Get plan comparison with current usage context and flexible billing options
router.get("/plans", 
    auth, 
    isOwner, 
    checkSubscriptionExpiry,
    getPlanComparison
);

// Manual sync route (admin use)
router.post("/sync-member-counts", 
    auth,
    isOwner,
    syncMemberCounts
);

// Calculate prorated upgrade pricing with flexible billing
router.post("/calculate-upgrade",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    validateRequest([
        body("targetPlan")
            .notEmpty()
            .withMessage("Target plan is required")
            .isIn(["BASIC", "ADVANCED", "ENTERPRISE"])
            .withMessage("Invalid target plan"),
        body("billing")
            .optional()
            .isIn(["monthly", "quarterly", "half-yearly", "yearly"]) // Updated with flexible options
            .withMessage("Invalid billing cycle. Must be: monthly, quarterly, half-yearly, or yearly")
    ]),
    calculateUpgradePrice
);

// Check usage limits before performing actions
router.post("/check-limit", auth, isOwner, async (req, res) => {
  try {
    const { action, count } = req.body;
    const { subscriptionPlan } = req.user; // comes from auth middleware

    // Define limits
    const planLimits = {
      NONE: 0,
      BASIC: 150,
      ADVANCED: 400,
      ENTERPRISE: Infinity
    };

    // Only handling "members" for now
    if (action === "members") {
      const memberCount = await Member.countDocuments({ owner: req.user.id });
      const limit = planLimits[subscriptionPlan] || 0;

      if (memberCount + count > limit) {
        return res.json({
          success: true,
          data: {
            canPerform: false,
            message: `Member limit reached for ${subscriptionPlan} plan. Max ${limit} allowed.`,
            current: memberCount,
            limit
          }
        });
      }

      return res.json({
        success: true,
        data: {
          canPerform: true,
          message: "You can add more members.",
          current: memberCount,
          limit
        }
      });
    }

    // If action type not supported
    res.json({ success: false, data: { canPerform: false, message: "Unsupported action." } });

  } catch (error) {
    console.error("Error in check-limit:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});


// Track feature usage
router.post("/track-usage",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    validateRequest([
        body("feature")
            .notEmpty()
            .withMessage("Feature is required")
            .isIn(["whatsappReminders", "analyticsViews", "searchQueries"])
            .withMessage("Invalid feature type")
    ]),
    trackFeatureUsage
);

// Process subscription upgrade (after payment) with flexible billing
router.post("/upgrade",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    validateRequest([
        body("targetPlan")
            .notEmpty()
            .withMessage("Target plan is required")
            .isIn(["BASIC", "ADVANCED", "ENTERPRISE"])
            .withMessage("Invalid target plan"),
        body("billing")
            .optional()
            .isIn(["monthly", "quarterly", "half-yearly", "yearly"]) // Updated with flexible options
            .withMessage("Invalid billing cycle. Must be: monthly, quarterly, half-yearly, or yearly"),
        body("paymentId")
            .optional()
            .isString()
            .withMessage("Payment ID must be a string"),
        body("orderId")
            .optional()
            .isString()
            .withMessage("Order ID must be a string")
    ]),
    processUpgrade
);

// Get usage analytics for dashboard
router.get("/analytics", 
    auth, 
    isOwner, 
    checkSubscriptionExpiry,
    getUsageAnalytics
);

// Update notification preferences
router.put("/notifications",
    auth,
    isOwner,
    validateRequest([
        body("expiryReminders")
            .optional()
            .isBoolean()
            .withMessage("Expiry reminders must be a boolean")
    ]),
    updateNotificationSettings
);

module.exports = router;