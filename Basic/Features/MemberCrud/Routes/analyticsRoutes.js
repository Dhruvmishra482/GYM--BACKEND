// routes/analyticsRoutes.js
const express = require("express");
const router = express.Router();

// Import analytics controllers
const {
  getBasicAnalytics,
  getMemberGrowthTrends,
  getPlanAnalytics
} = require("../Controllers/analyticsController");

// Import middleware
const { auth, isOwner } = require("../../Auth/Middleware/authMiddleware");
const { isSubscribed, checkSubscriptionExpiry } = require("../../Subscription/Middleware/subscriptionMiddleware");
const { checkFeatureLimit, trackFeatureUsage } = require("../../Subscription/Middleware/subscriptionMiddleware");

// ===== ANALYTICS ROUTES WITH SUBSCRIPTION PROTECTION =====

// Main analytics endpoint for BasicAnalyticsReports component
router.get("/basic", 
  (req, res, next) => {
    console.log("🔍 [ROUTE] Analytics /basic route hit");
    console.log("🔍 [ROUTE] Request URL:", req.originalUrl);
    console.log("🔍 [ROUTE] Request method:", req.method);
    next();
  },
  auth, 
  isOwner,
  checkSubscriptionExpiry,
  isSubscribed,
  // checkFeatureLimit('analyticsViews'),
  getBasicAnalytics
);
// Member growth trends (for detailed charts)
router.get("/growth-trends", 
  auth, 
  isOwner,
  checkSubscriptionExpiry,
  isSubscribed,
  // checkFeatureLimit('analyticsViews'),
  getMemberGrowthTrends
);

// Plan performance analytics
router.get("/plan-performance", 
  auth, 
  isOwner,
  checkSubscriptionExpiry,
  isSubscribed,
  // checkFeatureLimit('analyticsViews'),
  getPlanAnalytics
);

// Add this before your routes in analyticsRoutes.js
router.options("/basic", (req, res) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin);
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization,Cache-Control,Pragma,Expires");
  res.header("Access-Control-Allow-Credentials", "true");
  res.sendStatus(200);
});

// Add this to your analyticsRoutes.js temporarily
router.get("/test", (req, res) => {
  console.log("🧪 TEST ROUTE HIT");
  res.json({
    success: true,
    message: "Analytics route is working",
    timestamp: new Date().toISOString()
  });
});

// Preview route for non-subscribers
router.get("/preview", 
  auth, 
  isOwner,
  checkSubscriptionExpiry,
  (req, res) => {
    const user = req.user;
    
    if (user.subscriptionPlan === "NONE" || !user.hasActiveSubscription()) {
      return res.json({
        success: true,
        hasAccess: false,
        message: "Subscription required to access analytics",
        needsSubscription: true,
        preview: {
          title: "Analytics & Reports Preview",
          description: "Get powerful insights about your gym's performance",
          features: [
            "📊 Real-time member analytics and growth trends",
            "💰 Revenue tracking and financial insights", 
            "📈 Member retention and engagement metrics",
            "🎯 Plan performance and pricing optimization",
            "📱 Age group and demographics analysis",
            "💳 Payment method preferences tracking",
            "📅 Due payment predictions and alerts",
            "🏆 Performance benchmarking tools"
          ],
          sampleData: {
            totalMembers: "150+",
            monthlyRevenue: "₹45,000+",
            retentionRate: "85%+",
            analyticsViews: "Unlimited"
          }
        },
        upgrade: {
          plan: "BASIC",
          price: "₹399/month",
          savings: "Save ₹798 with yearly plan",
          cta: "Unlock Analytics Dashboard"
        }
      });
    }

    // User has subscription - redirect to main analytics
    return res.redirect('/api/v1/analytics/basic');
  }
);

router.get("/test-members", auth, async (req, res) => {
  try {
    const members = await Member.find({ ownerId: req.user.id });
    res.json({
      success: true,
      memberCount: members.length,
      members: members.slice(0, 2) // First 2 members
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Usage statistics for the user (show their current usage)
router.get("/usage-stats", 
  auth, 
  isOwner,
  checkSubscriptionExpiry,
  async (req, res) => {
    try {
      const Owner = require("../../MemberCrud/Models/Owner");
      const user = await Owner.findById(req.user.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      const planLimits = user.getPlanLimits();
      const usageStats = {
        analyticsViews: {
          used: user.usageStats.featureUsage.analyticsViews.count,
          limit: planLimits.analyticsViews,
          percentage: user.getUsagePercentage('analyticsViews'),
          remaining: planLimits.analyticsViews === -1 ? "Unlimited" : 
                    Math.max(planLimits.analyticsViews - user.usageStats.featureUsage.analyticsViews.count, 0)
        },
        resetDate: user.billingCycle.nextResetDate,
        plan: user.subscriptionPlan
      };

      return res.json({
        success: true,
        data: usageStats
      });

    } catch (error) {
      console.error("Usage stats error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve usage statistics"
      });
    }
  }
);

module.exports = router;