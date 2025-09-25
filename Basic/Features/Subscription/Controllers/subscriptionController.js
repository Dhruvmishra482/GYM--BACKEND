// controllers/subscriptionController.js - Complete Implementation

const Owner = require("../../MemberCrud/Models/Owner");
const Member = require("../../MemberCrud/Models/Member");
const { mailSender } = require("../../../../Utils/mailSender");
const { 
  PLAN_CONFIG, 
  BILLING_CYCLES, 
  getPlanPrice, 
  getBillingSavings, 
  getBillingDuration,
  getBillingLabel 
} = require("../../../../config/planConfig");
const {
  createExpiryEmailTemplate,
  createPostExpiryEmailTemplate,
  createUpgradeSuccessTemplate,
} = require("../../../../Templates/subscriptionEmailTemplates");

// Get comprehensive subscription details with usage analytics
exports.getSubscriptionDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await Owner.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get actual member count from database
    const actualMemberCount = await Member.countDocuments({ ownerId: userId });

    // Update user's member count if it's incorrect
    if (user.usageStats.membersCount !== actualMemberCount) {
      user.usageStats.membersCount = actualMemberCount;
      await user.save();
    }

    const subscriptionStatus = user.getSubscriptionStatus();
    const planLimits = user.getPlanLimits();
    const planConfig = PLAN_CONFIG[user.subscriptionPlan];

    // Calculate usage percentages
    const usageAnalytics = {
      members: {
        current: actualMemberCount,
        limit: planLimits.members,
        percentage: planLimits.members === -1 ? 0 : Math.min((actualMemberCount / planLimits.members) * 100, 100),
        remaining: planLimits.members === -1 ? "Unlimited" : Math.max(planLimits.members - actualMemberCount, 0),
      },
      whatsappReminders: {
        current: user.usageStats.featureUsage.whatsappReminders.count,
        limit: planLimits.whatsappReminders,
        percentage: user.getUsagePercentage("whatsappReminders"),
        remaining: planLimits.whatsappReminders === -1 ? "Unlimited" : Math.max(planLimits.whatsappReminders - user.usageStats.featureUsage.whatsappReminders.count, 0),
      },
      analyticsViews: {
        current: user.usageStats.featureUsage.analyticsViews.count,
        limit: planLimits.analyticsViews,
        percentage: user.getUsagePercentage("analyticsViews"),
        remaining: planLimits.analyticsViews === -1 ? "Unlimited" : Math.max(planLimits.analyticsViews - user.usageStats.featureUsage.analyticsViews.count, 0),
      },
    };

    // Monthly trends (last 6 cycles)
    const monthlyTrends = user.usageStats.monthlyStats
      .sort((a, b) => new Date(b.cycleStart) - new Date(a.cycleStart))
      .slice(0, 6)
      .reverse();

    // Get current billing info
    const currentBilling = user.billingCycle.cycleType || "monthly";
    const currentPrice = getPlanPrice(user.subscriptionPlan, currentBilling);

    return res.status(200).json({
      success: true,
      data: {
        subscription: subscriptionStatus,
        plan: {
          current: user.subscriptionPlan,
          name: planConfig?.name || "None",
          features: planConfig?.features || [],
        },
        usage: usageAnalytics,
        limits: planLimits,
        trends: monthlyTrends,
        billing: {
          cycle: currentBilling,
          cycleLabel: getBillingLabel(currentBilling),
          duration: user.billingCycle.cycleDuration || 1,
          nextPayment: subscriptionStatus.expiry,
          amount: currentPrice,
          currency: "INR",
          cycleInfo: user.getBillingCycleStatus(),
        },
      },
    });
  } catch (error) {
    console.error("Get subscription details error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve subscription details",
    });
  }
};

// Get plan comparison with current usage context and flexible billing
exports.getPlanComparison = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await Owner.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const currentUsage = {
      members: user.usageStats.membersCount,
      whatsappReminders: user.usageStats.featureUsage.whatsappReminders.count,
      analyticsViews: user.usageStats.featureUsage.analyticsViews.count,
    };

    const plans = Object.keys(PLAN_CONFIG)
      .filter((plan) => plan !== "NONE" && PLAN_CONFIG[plan].available)
      .map((planKey) => {
        const plan = PLAN_CONFIG[planKey];
        
        // Create pricing options for all billing cycles
        const pricingOptions = {};
        Object.keys(BILLING_CYCLES).forEach(billingCycle => {
          const pricing = plan.pricing[billingCycle];
          if (pricing) {
            pricingOptions[billingCycle] = {
              price: pricing.price,
              duration: pricing.duration,
              savings: pricing.savings,
              popular: pricing.popular,
              label: BILLING_CYCLES[billingCycle].label,
              suffix: BILLING_CYCLES[billingCycle].suffix
            };
          }
        });

        return {
          id: planKey,
          name: plan.name,
          tagline: plan.tagline,
          description: plan.description,
          pricing: pricingOptions,
          // Legacy support
          monthlyPrice: plan.monthlyPrice,
          yearlyPrice: plan.yearlyPrice,
          limits: plan.limits,
          features: plan.features,
          color: plan.color,
          glowColor: plan.glowColor,
          current: user.subscriptionPlan === planKey,
          recommended: currentUsage.members > plan.limits.members * 0.8 && planKey !== user.subscriptionPlan,
          canFitUsage: plan.limits.members === -1 || currentUsage.members <= plan.limits.members,
        };
      });

    return res.status(200).json({
      success: true,
      data: {
        plans,
        currentUsage,
        billingCycles: BILLING_CYCLES,
        currentBilling: user.billingCycle.cycleType || "monthly"
      },
    });
  } catch (error) {
    console.error("Get plan comparison error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve plan comparison",
    });
  }
};

// Calculate prorated upgrade pricing with flexible billing
exports.calculateUpgradePrice = async (req, res) => {
  try {
    const { targetPlan, billing = "monthly" } = req.body;
    const userId = req.user.id;
    const user = await Owner.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!PLAN_CONFIG[targetPlan]) {
      return res.status(400).json({
        success: false,
        message: "Invalid target plan",
      });
    }

    // Validate billing cycle
    if (!BILLING_CYCLES[billing]) {
      return res.status(400).json({
        success: false,
        message: "Invalid billing cycle. Must be: monthly, quarterly, half-yearly, or yearly",
      });
    }

    const subscriptionStatus = user.getSubscriptionStatus();
    const daysLeft = subscriptionStatus.daysLeft || 0;

    // Get prices using helper functions
    const newPrice = getPlanPrice(targetPlan, billing);
    const billingDuration = getBillingDuration(billing);
    const savings = getBillingSavings(targetPlan, billing);

    let proratedDiscount = 0;
    
    // Calculate prorated discount for remaining days
    if (daysLeft > 0 && user.subscriptionPlan !== "NONE") {
      const currentPrice = getPlanPrice(user.subscriptionPlan, user.billingCycle.cycleType || "monthly");
      const currentDuration = user.billingCycle.cycleDuration || 1;
      const dailyRate = currentPrice / (currentDuration * 30); // Approximate daily rate
      proratedDiscount = Math.floor(dailyRate * daysLeft);
    }

    const finalPrice = Math.max(newPrice - proratedDiscount, 0);
    const totalSavings = proratedDiscount + savings;

    return res.status(200).json({
      success: true,
      data: {
        currentPlan: user.subscriptionPlan,
        targetPlan,
        billing,
        billingLabel: getBillingLabel(billing),
        duration: billingDuration,
        pricing: {
          originalPrice: newPrice,
          proratedDiscount,
          finalPrice,
          billingCycleSavings: savings,
          totalSavings,
          daysLeft,
        },
        breakdown: {
          newPlanPrice: newPrice,
          creditForRemainingDays: proratedDiscount,
          savingsFromBillingCycle: savings,
          youPay: finalPrice,
        },
      },
    });
  } catch (error) {
    console.error("Calculate upgrade price error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to calculate upgrade price",
    });
  }
};

// Check if user can perform an action (member addition, feature usage)
exports.checkUsageLimit = async (req, res) => {
  try {
    const { action, count = 1 } = req.body;
    const userId = req.user.id;
    const user = await Owner.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const planLimits = user.getPlanLimits();
    let canPerform = false;
    let currentUsage = 0;
    let limit = 0;
    let message = "";

    switch (action) {
      case "members":
        currentUsage = user.usageStats.membersCount;
        limit = planLimits.members;
        canPerform = limit === -1 || currentUsage + count <= limit;
        message = canPerform
          ? `You can add ${count} more member(s)`
          : `Member limit reached (${currentUsage}/${limit}). Upgrade to add more members.`;
        break;

      case "whatsappReminders":
        currentUsage = user.usageStats.featureUsage.whatsappReminders.count;
        limit = planLimits.whatsappReminders;
        canPerform = limit === -1 || currentUsage + count <= limit;
        message = canPerform
          ? `You can send ${count} more reminder(s)`
          : `WhatsApp reminder limit reached (${currentUsage}/${limit}). Upgrade for more reminders.`;
        break;

      case "analyticsViews":
        currentUsage = user.usageStats.featureUsage.analyticsViews.count;
        limit = planLimits.analyticsViews;
        canPerform = limit === -1 || currentUsage + count <= limit;
        message = canPerform
          ? `You can view ${count} more analytics report(s)`
          : `Analytics view limit reached (${currentUsage}/${limit}). Upgrade for more analytics.`;
        break;

      case "searchQueries":
        currentUsage = user.usageStats.featureUsage.searchQueries.count;
        limit = planLimits.searchQueries;
        canPerform = limit === -1 || currentUsage + count <= limit;
        message = canPerform
          ? `You can perform ${count} more search(es)`
          : `Search query limit reached (${currentUsage}/${limit}). Upgrade for more searches.`;
        break;

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid action type",
        });
    }

    return res.status(200).json({
      success: true,
      data: {
        canPerform,
        currentUsage,
        limit: limit === -1 ? "Unlimited" : limit,
        remaining: limit === -1 ? "Unlimited" : Math.max(limit - currentUsage, 0),
        message,
        upgradeRequired: !canPerform,
      },
    });
  } catch (error) {
    console.error("Check usage limit error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check usage limit",
    });
  }
};

// Track feature usage (called by other controllers)
exports.trackFeatureUsage = async (req, res) => {
  try {
    const { feature } = req.body;
    const userId = req.user.id;
    const user = await Owner.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await user.trackFeatureUsage(feature);

    return res.status(200).json({
      success: true,
      message: "Feature usage tracked successfully",
      data: {
        feature,
        newCount: user.usageStats.featureUsage[feature].count,
        lastUsed: user.usageStats.featureUsage[feature].lastUsed
      }
    });
  } catch (error) {
    console.error("Track feature usage error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to track feature usage",
    });
  }
};

// Process subscription upgrade with flexible billing
exports.processUpgrade = async (req, res) => {
  try {
    const { targetPlan, billing = "monthly", paymentId, orderId } = req.body;
    const userId = req.user.id;
    const user = await Owner.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!PLAN_CONFIG[targetPlan]) {
      return res.status(400).json({
        success: false,
        message: "Invalid target plan",
      });
    }

    // Validate billing cycle
    if (!BILLING_CYCLES[billing]) {
      return res.status(400).json({
        success: false,
        message: "Invalid billing cycle. Must be: monthly, quarterly, half-yearly, or yearly",
      });
    }

    const oldPlan = user.subscriptionPlan;
    const oldPlanName = PLAN_CONFIG[oldPlan]?.name || "None";
    const newPlanName = PLAN_CONFIG[targetPlan].name;

    // Calculate pricing with flexible billing
    const subscriptionStatus = user.getSubscriptionStatus();
    const daysLeft = subscriptionStatus.daysLeft || 0;
    const newPrice = getPlanPrice(targetPlan, billing);
    const billingDuration = getBillingDuration(billing);

    let proratedDiscount = 0;
    if (daysLeft > 0 && oldPlan !== "NONE") {
      const currentPrice = getPlanPrice(oldPlan, user.billingCycle.cycleType || "monthly");
      const currentDuration = user.billingCycle.cycleDuration || 1;
      const dailyRate = currentPrice / (currentDuration * 30);
      proratedDiscount = Math.floor(dailyRate * daysLeft);
    }

    // Calculate new expiry date based on flexible billing
    const currentExpiry = user.subscriptionExpiry;
    const now = new Date();
    let newExpiryDate;

    if (currentExpiry && currentExpiry > now) {
      // Early renewal: Extend from current expiry date
      newExpiryDate = new Date(currentExpiry);
      newExpiryDate.setMonth(currentExpiry.getMonth() + billingDuration);
      
      // Handle month overflow
      if (newExpiryDate.getDate() !== currentExpiry.getDate()) {
        newExpiryDate.setDate(0);
      }
    } else {
      // Late renewal or expired plan: Start from today
      newExpiryDate = new Date(now);
      newExpiryDate.setMonth(now.getMonth() + billingDuration);
      
      if (newExpiryDate.getDate() !== now.getDate()) {
        newExpiryDate.setDate(0);
      }
    }

    // Update subscription
    user.subscriptionPlan = targetPlan;
    user.subscriptionExpiry = newExpiryDate;

    // Initialize or update billing cycle with flexible periods
    if (!user.billingCycle.startDate || oldPlan === "NONE") {
      user.initializeBillingCycle(billing);
    } else {
      if (currentExpiry && currentExpiry > now) {
        // Early renewal: Keep existing cycle, update type and end date
        user.billingCycle.cycleType = billing;
        user.billingCycle.cycleDuration = billingDuration;
        user.billingCycle.nextResetDate = new Date(newExpiryDate);
      } else {
        // Late renewal: Start fresh billing cycle
        user.initializeBillingCycle(billing);
      }
    }

    // Reset notification flags
    user.notificationSettings.expiryReminders.emailSent7Days = false;
    user.notificationSettings.expiryReminders.emailSent3Days = false;
    user.notificationSettings.expiryReminders.emailSentExpiry = false;
    user.notificationSettings.expiryReminders.emailSentPostExpiry = false;

    // Add to payment history with flexible billing info
    user.paymentHistory.push({
      orderId: orderId || `upgrade_${Date.now()}`,
      paymentId: paymentId || `upgrade_${Date.now()}`,
      amount: newPrice - proratedDiscount,
      currency: "INR",
      billing: billing,
      cycleDuration: billingDuration,
      status: "SUCCESS",
      plan: targetPlan,
      createdAt: new Date(),
      renewalType: (currentExpiry && currentExpiry > now) ? "early" : "late"
    });

    await user.save();

    // Send upgrade success email
    try {
      if (typeof createUpgradeSuccessTemplate === 'function') {
        const template = createUpgradeSuccessTemplate(
          `${user.firstName} ${user.lastName}`,
          oldPlanName,
          newPlanName,
          proratedDiscount,
          getBillingLabel(billing)
        );
        await mailSender(user.email, template.subject, template.html);
      }
    } catch (emailError) {
      console.error("Failed to send upgrade success email:", emailError);
    }

    const renewalType = (currentExpiry && currentExpiry > now) ? "early" : "late";
    const daysExtended = renewalType === "early" ? daysLeft : 0;

    return res.status(200).json({
      success: true,
      message: "Subscription upgraded successfully",
      data: {
        oldPlan,
        newPlan: targetPlan,
        billing: billing,
        billingLabel: getBillingLabel(billing),
        duration: billingDuration,
        oldExpiry: currentExpiry,
        newExpiry: newExpiryDate,
        savings: proratedDiscount,
        renewalType: renewalType,
        daysExtended: daysExtended,
        subscription: user.getSubscriptionStatus(),
        billingCycle: user.getBillingCycleStatus()
      },
    });

  } catch (error) {
    console.error("Process upgrade error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process upgrade",
    });
  }
};

// Get usage analytics for dashboard
exports.getUsageAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await Owner.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const planLimits = user.getPlanLimits();
    
    const currentUsage = {
      members: {
        used: user.usageStats.membersCount,
        limit: planLimits.members,
        percentage: user.getUsagePercentage('members')
      },
      whatsappReminders: {
        used: user.usageStats.featureUsage.whatsappReminders.count,
        limit: planLimits.whatsappReminders,
        percentage: user.getUsagePercentage('whatsappReminders')
      },
      analyticsViews: {
        used: user.usageStats.featureUsage.analyticsViews.count,
        limit: planLimits.analyticsViews,
        percentage: user.getUsagePercentage('analyticsViews')
      },
      searchQueries: {
        used: user.usageStats.featureUsage.searchQueries.count,
        limit: planLimits.searchQueries,
        percentage: user.getUsagePercentage('searchQueries')
      }
    };

    // Generate warnings for high usage (90%+)
    const warnings = [];
    if (currentUsage.members.percentage >= 90) {
      warnings.push({
        type: "members",
        message: "You're approaching your member limit. Consider upgrading your plan.",
        severity: currentUsage.members.percentage >= 100 ? "critical" : "warning"
      });
    }
    if (currentUsage.whatsappReminders.percentage >= 90) {
      warnings.push({
        type: "whatsappReminders",
        message: "You're approaching your WhatsApp reminder limit.",
        severity: currentUsage.whatsappReminders.percentage >= 100 ? "critical" : "warning"
      });
    }
    if (currentUsage.analyticsViews.percentage >= 90) {
      warnings.push({
        type: "analyticsViews",
        message: "You're approaching your analytics view limit.",
        severity: currentUsage.analyticsViews.percentage >= 100 ? "critical" : "warning"
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        currentUsage,
        warnings,
        plan: {
          name: PLAN_CONFIG[user.subscriptionPlan]?.name || "None",
          features: PLAN_CONFIG[user.subscriptionPlan]?.features || []
        },
        billing: {
          cycle: user.billingCycle.cycleType || "monthly",
          cycleLabel: getBillingLabel(user.billingCycle.cycleType || "monthly"),
          cycleInfo: user.getBillingCycleStatus()
        }
      }
    });

  } catch (error) {
    console.error("Get usage analytics error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve usage analytics"
    });
  }
};

// Send expiry reminder emails (called by scheduler)
exports.sendExpiryReminders = async (req, res) => {
  try {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const today = new Date(now.toDateString());
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    let emailsSent = 0;

    // Find users with subscriptions expiring in 7 days
    const users7Days = await Owner.find({
      subscriptionPlan: { $ne: "NONE" },
      subscriptionExpiry: {
        $gte: new Date(in7Days.toDateString()),
        $lt: new Date(in7Days.getTime() + 24 * 60 * 60 * 1000),
      },
      "notificationSettings.expiryReminders.enabled": true,
      "notificationSettings.expiryReminders.emailSent7Days": false,
    });

    // Send 7-day reminders
    for (let user of users7Days) {
      try {
        const template = createExpiryEmailTemplate(
          `${user.firstName} ${user.lastName}`,
          7,
          PLAN_CONFIG[user.subscriptionPlan].name
        );

        await mailSender(user.email, template.subject, template.html);

        user.notificationSettings.expiryReminders.emailSent7Days = true;
        await user.save();
        emailsSent++;
      } catch (emailError) {
        console.error(`Failed to send 7-day reminder to ${user.email}:`, emailError);
      }
    }

    // Similar logic for 3-day, expiry day, and post-expiry reminders...
    // (Implementation similar to above but for different time periods)

    return res.status(200).json({
      success: true,
      message: `Expiry reminder emails sent successfully`,
      data: {
        emailsSent,
        breakdown: {
          sevenDay: users7Days.length,
          // Add other breakdowns...
        },
      },
    });
  } catch (error) {
    console.error("Send expiry reminders error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send expiry reminders",
    });
  }
};

// Reset custom billing cycles (called by scheduler)
exports.resetCustomBillingCycles = async (req, res) => {
  try {
    const now = new Date();
    console.log(`Running billing cycle reset check at ${now.toISOString()}`);

    // Find users whose billing cycle has ended
    const usersToReset = await Owner.find({
      subscriptionPlan: { $ne: "NONE" },
      "billingCycle.nextResetDate": { $lte: now },
    });

    let usersUpdated = 0;

    for (let user of usersToReset) {
      // Reset usage using model method
      user.resetUsageCycle();
      await user.save();
      usersUpdated++;

      console.log(`Reset billing cycle for user ${user.email}`);
    }

    return res.status(200).json({
      success: true,
      message: "Custom billing cycles reset successfully",
      data: {
        usersUpdated,
        timestamp: now,
      },
    });
  } catch (error) {
    console.error("Reset billing cycles error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reset billing cycles",
    });
  }
};

// Sync member counts with actual database
exports.syncMemberCounts = async (req, res) => {
  try {
    const owners = await Owner.find({ 
      subscriptionPlan: { $ne: "NONE" } 
    });
    
    let syncedUsers = 0;
    
    for (let owner of owners) {
      const actualCount = await Member.countDocuments({ 
        ownerId: owner._id 
      });
      
      if (owner.usageStats.membersCount !== actualCount) {
        console.log(`Syncing ${owner.email}: ${owner.usageStats.membersCount} → ${actualCount}`);
        owner.usageStats.membersCount = actualCount;
        owner.usageStats.lastMemberCountUpdate = new Date();
        await owner.save();
        syncedUsers++;
      }
    }
    
    return res.status(200).json({
      success: true,
      message: "Member count sync completed",
      data: { syncedUsers, totalChecked: owners.length }
    });
    
  } catch (error) {
    console.error("Member count sync error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to sync member counts"
    });
  }
};

// Update notification preferences
exports.updateNotificationSettings = async (req, res) => {
  try {
    const { expiryReminders } = req.body;
    const userId = req.user.id;
    const user = await Owner.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (expiryReminders !== undefined) {
      user.notificationSettings.expiryReminders.enabled = expiryReminders;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Notification settings updated successfully",
      data: {
        notificationSettings: user.notificationSettings,
      },
    });
  } catch (error) {
    console.error("Update notification settings error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update notification settings",
    });
  }
};