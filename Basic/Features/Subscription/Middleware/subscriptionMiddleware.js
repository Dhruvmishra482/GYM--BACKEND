const Owner = require("../../MemberCrud/Models/Owner");

// Middleware to check if user has active subscription
exports.isSubscribed = async (req, res, next) => {
  try {
    // This middleware assumes auth middleware has already run and req.user exists
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    // Get fresh user data to check subscription
    const user = await Owner.findById(req.user.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if user has active subscription
    if (!user.hasActiveSubscription()) {
      return res.status(403).json({
        success: false,
        message: "Active subscription required to access this feature",
        subscriptionRequired: true,
        currentPlan: user.subscriptionPlan,
       needsSubscription: true
      });
    }

    // Attach subscription status to request for future use
    req.subscription = user.getSubscriptionStatus();
    next();
  } catch (error) {
    console.error("Subscription middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Subscription service error"
    });
  }
};

// Middleware to check specific subscription plan
exports.requirePlan = (requiredPlan) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required"
        });
      }

      const user = await Owner.findById(req.user.id);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found"
        });
      }

      // Define plan hierarchy
      const planHierarchy = {
        "FREE": 0,
        "BASIC": 1,
        "PREMIUM": 2
      };

      const userPlanLevel = planHierarchy[user.subscriptionPlan] || 0;
      const requiredPlanLevel = planHierarchy[requiredPlan] || 0;

      // Check if user's plan meets the requirement
      if (userPlanLevel < requiredPlanLevel) {
        return res.status(403).json({
          success: false,
          message: `${requiredPlan} subscription required to access this feature`,
          subscriptionRequired: true,
          currentPlan: user.subscriptionPlan,
          requiredPlan: requiredPlan
        });
      }

      // Also check if subscription is active (not expired)
      if (user.subscriptionPlan !== "FREE" && !user.hasActiveSubscription()) {
        return res.status(403).json({
          success: false,
          message: "Your subscription has expired. Please renew to continue",
          subscriptionExpired: true,
          currentPlan: user.subscriptionPlan
        });
      }

      req.subscription = user.getSubscriptionStatus();
      next();
    } catch (error) {
      console.error("Plan requirement middleware error:", error);
      return res.status(500).json({
        success: false,
        message: "Subscription service error"
      });
    }
  };
};

// Utility middleware to check and auto-downgrade expired subscriptions
exports.checkSubscriptionExpiry = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    const user = await Owner.findById(req.user.id);
    if (!user) {
      return next();
    }

    // Check if subscription is expired and auto-downgrade
    if (user.subscriptionPlan !== "NONE" && !user.hasActiveSubscription()) {
      user.subscriptionPlan = "NONE"; // Downgrade to NONE (no subscription)
      user.subscriptionExpiry = null;
      await user.save();
      
      // Update req.user with fresh data
      req.user.subscriptionPlan = "NONE";
      req.user.subscriptionExpiry = null;
      
      console.log(`Auto-downgraded user ${user.email} to NONE (no subscription) due to expiry`);
    }

    next();
  } catch (error) {
    console.error("Subscription expiry check error:", error);
    // Don't block the request, just log the error
    next();
  }
};