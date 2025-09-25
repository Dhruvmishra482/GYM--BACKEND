const express = require('express');
const router = express.Router();
const {
   getOwnerProfile,
   updateOwnerProfile,
   completeGymOnboarding,
   getOnboardingStatus
 } = require('../Controllers/ownerProfileController')

const { auth, isOwner } = require("../../Auth/Middleware/authMiddleware");
const { checkSubscriptionExpiry } = require("../../Subscription/Middleware/subscriptionMiddleware");

// @route   GET /api/owner/profile
// @desc    Get owner profile (includes subscription info and gym details)
// @access  Private (Owner only)
router.get('/profile', 
  auth, 
  isOwner, 
  checkSubscriptionExpiry,
  getOwnerProfile
);

// @route   PUT /api/owner/profile
// @desc    Update owner profile (basic info only, subscription managed separately)
// @access  Private (Owner only)
router.put('/profile', 
  auth, 
  isOwner, 
  checkSubscriptionExpiry,
  updateOwnerProfile
);

// @route   GET /api/owner/onboarding-status
// @desc    Check if owner needs to complete gym onboarding
// @access  Private (Owner only)
router.get('/onboarding-status', 
  auth, 
  isOwner,
  getOnboardingStatus
);

// @route   POST /api/owner/complete-onboarding
// @desc    Complete gym onboarding (gym name and logo)
// @access  Private (Owner only)
router.post('/complete-onboarding', 
  auth, 
  isOwner,
  completeGymOnboarding
);

// @route   GET /api/owner/dashboard-status
// @desc    Get dashboard access status based on subscription
// @access  Private (Owner only)
router.get('/dashboard-status', 
  auth, 
  isOwner,
  checkSubscriptionExpiry,
  (req, res) => {
    const { subscriptionPlan, hasActiveSubscription } = req.user;
    
    if (subscriptionPlan === "NONE" || !hasActiveSubscription) {
      return res.json({
        success: true,
        hasAccess: false,
        message: "Subscription required to access dashboard features",
        currentPlan: subscriptionPlan,
        needsSubscription: true,
        upgradeMessage: "Start Your Gym Journey with our Basic plan!",
        features: [
          "Up to 150 members",
          "AI-powered member insights",
          "Smart payment reminders (WhatsApp)",
          "Member dashboard with profiles",
          "24/7 chat & email support"
        ]
      });
    }

    return res.json({
      success: true,
      hasAccess: true,
      message: `Welcome to your ${subscriptionPlan} dashboard!`,
      currentPlan: subscriptionPlan,
      needsSubscription: false
    });
  }
);

module.exports = router;