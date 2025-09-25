// controllers/analyticsController.js - Debug Enhanced Version
const Owner = require("../../MemberCrud/Models/Owner");
const Member = require("../../MemberCrud/Models/Member");

// Get comprehensive analytics data for BasicAnalyticsReports component
exports.getBasicAnalytics = async (req, res) => {
  try {
    console.log("🎯 [Analytics] getBasicAnalytics called");
    console.log("👤 [Analytics] User ID:", req.user?.id);
    console.log("📋 [Analytics] Request headers:", req.headers);
    console.log("🔐 [Analytics] Request user:", req.user);

    const userId = req.user.id;
    const user = await Owner.findById(userId);

    if (!user) {
      console.log("❌ [Analytics] User not found");
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    console.log("👤 [Analytics] User found:", {
      email: user.email,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionExpiry: user.subscriptionExpiry,
      hasActiveSubscription: user.hasActiveSubscription()
    });

    // Check if user has active subscription
    if (!user.hasActiveSubscription()) {
      console.log("❌ [Analytics] No active subscription");
      return res.status(403).json({
        success: false,
        message: "Active subscription required to access analytics",
        subscriptionRequired: true,
        currentPlan: user.subscriptionPlan,
        needsSubscription: true
      });
    }

    console.log("✅ [Analytics] User has active subscription:", user.subscriptionPlan);

    // DEBUG: Check Member model and query
    console.log("🔍 [Analytics] Querying members with ownerId:", userId);
    
    // Get all members for this owner
    const allMembers = await Member.find({ ownerId: userId }).sort({ joiningDate: -1 });
    console.log("📊 [Analytics] Total members found:", allMembers.length);

    // DEBUG: Log member query details
    console.log("🔍 [Analytics] Member query details:", {
      query: { ownerId: userId },
      resultCount: allMembers.length,
      memberSchema: allMembers.length > 0 ? Object.keys(allMembers[0].toObject()) : "No members"
    });

    // Debug: Log first member structure if exists
    if (allMembers.length > 0) {
      console.log("👤 [Analytics] Sample member:", {
        _id: allMembers[0]._id,
        name: allMembers[0].name,
        ownerId: allMembers[0].ownerId,
        feesAmount: allMembers[0].feesAmount,
        paymentStatus: allMembers[0].paymentStatus,
        nextDueDate: allMembers[0].nextDueDate,
        planDuration: allMembers[0].planDuration,
        paymentMethod: allMembers[0].paymentMethod,
        age: allMembers[0].age,
        joiningDate: allMembers[0].joiningDate
      });
    } else {
      console.log("⚠️ [Analytics] No members found for this owner");
      
      // Return empty analytics but with proper structure
      const emptyAnalytics = {
        totalMembers: 0,
        activeMembers: 0,
        newMembersLast30Days: 0,
        newMembersLast7Days: 0,
        totalRevenue: 0,
        monthlyRevenue: 0,
        dueToday: 0,
        overdue: 0,
        planDistribution: {},
        paymentMethods: {},
        ageGroups: {},
        genderDistribution: {},
        retentionRate: 0,
        averageRevenue: 0,
        monthlyGrowthData: generateMonthlyGrowthData([], 6),
        monthlyRevenueData: generateMonthlyRevenueData([], 6)
      };

      console.log("📈 [Analytics] Returning empty analytics");
      
      // Track analytics view usage
      await user.trackFeatureUsage('analyticsViews');
      console.log("✅ [Analytics] Usage tracked");

      return res.status(200).json({
        success: true,
        message: "Analytics data retrieved successfully (no members found)",
        data: {
          analytics: emptyAnalytics,
          userPlan: user.subscriptionPlan,
          lastUpdated: new Date().toISOString(),
          memberCount: 0
        }
      });
    }

    // Calculate current date for comparisons
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get date ranges for analytics
    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
    const sevenDaysAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));

    console.log("📅 [Analytics] Date ranges:", {
      today: today.toISOString(),
      thirtyDaysAgo: thirtyDaysAgo.toISOString(),
      sevenDaysAgo: sevenDaysAgo.toISOString()
    });

    // Calculate comprehensive analytics
    const analytics = {
      // Basic member statistics
      totalMembers: allMembers.length,
      
      // Active members (paid status and future due date)
      activeMembers: allMembers.filter(member => {
        if (!member.nextDueDate) return false;
        const dueDate = new Date(member.nextDueDate);
        return (member.paymentStatus?.toLowerCase() === 'paid' || 
                member.paymentStatus?.toLowerCase() === 'active') && 
               dueDate > today;
      }).length,

      // New members (last 30 days by default, can be filtered by timeRange)
      newMembersLast30Days: allMembers.filter(member => {
        const joinDate = new Date(member.joinDate || member.joiningDate);
        return joinDate >= thirtyDaysAgo;
      }).length,

      newMembersLast7Days: allMembers.filter(member => {
        const joinDate = new Date(member.joinDate || member.joiningDate);
        return joinDate >= sevenDaysAgo;
      }).length,

      // Revenue calculations
      totalRevenue: allMembers.reduce((sum, member) => {
        const amount = parseFloat(member.feesAmount?.toString().replace(/[^\d.]/g, '') || 0);
        return sum + amount;
      }, 0),

      monthlyRevenue: allMembers.filter(member => {
        const joinDate = new Date(member.joinDate || member.joiningDate);
        return joinDate.getMonth() === today.getMonth() && 
               joinDate.getFullYear() === today.getFullYear();
      }).reduce((sum, member) => {
        const amount = parseFloat(member.feesAmount?.toString().replace(/[^\d.]/g, '') || 0);
        return sum + amount;
      }, 0),

      // Due analysis
      dueToday: allMembers.filter(member => {
        if (!member.nextDueDate) return false;
        const dueDate = new Date(member.nextDueDate);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate.getTime() === today.getTime();
      }).length,

      overdue: allMembers.filter(member => {
        if (!member.nextDueDate) return false;
        const dueDate = new Date(member.nextDueDate);
        return dueDate < today || member.paymentStatus?.toLowerCase() === 'pending';
      }).length,

      // Plan distribution analysis
      planDistribution: allMembers.reduce((acc, member) => {
        const plan = member.planDuration || 'Unknown';
        acc[plan] = (acc[plan] || 0) + 1;
        return acc;
      }, {}),

      // Payment method analysis
      paymentMethods: allMembers.reduce((acc, member) => {
        const method = member.paymentMethod || 'Cash';
        acc[method] = (acc[method] || 0) + 1;
        return acc;
      }, {}),

      // Age group distribution
      ageGroups: allMembers.reduce((acc, member) => {
        const age = parseInt(member.age) || 0;
        let group;
        if (age < 18) group = 'Under 18';
        else if (age < 25) group = '18-25';
        else if (age < 35) group = '26-35';
        else if (age < 45) group = '36-45';
        else group = '45+';
        
        acc[group] = (acc[group] || 0) + 1;
        return acc;
      }, {}),

      // Gender distribution
      genderDistribution: allMembers.reduce((acc, member) => {
        const gender = member.gender || 'Not specified';
        acc[gender] = (acc[gender] || 0) + 1;
        return acc;
      }, {}),

      // Retention rate calculation
      retentionRate: allMembers.length > 0 ? 
        Math.round((allMembers.filter(member => {
          if (!member.nextDueDate) return false;
          const dueDate = new Date(member.nextDueDate);
          return member.paymentStatus?.toLowerCase() === 'paid' && dueDate > today;
        }).length / allMembers.length) * 100) : 0,

      // Average revenue per member
      averageRevenue: allMembers.length > 0 ? 
        Math.round(allMembers.reduce((sum, member) => {
          const amount = parseFloat(member.feesAmount?.toString().replace(/[^\d.]/g, '') || 0);
          return sum + amount;
        }, 0) / allMembers.length) : 0,

      // Monthly growth data (last 6 months)
      monthlyGrowthData: generateMonthlyGrowthData(allMembers, 6),

      // Revenue trends (last 6 months)
      monthlyRevenueData: generateMonthlyRevenueData(allMembers, 6)
    };

    console.log("📈 [Analytics] Calculated analytics:", {
      totalMembers: analytics.totalMembers,
      activeMembers: analytics.activeMembers,
      totalRevenue: analytics.totalRevenue,
      planDistribution: analytics.planDistribution,
      paymentMethods: analytics.paymentMethods,
      ageGroups: analytics.ageGroups,
      newMembersLast30Days: analytics.newMembersLast30Days,
      dueToday: analytics.dueToday,
      overdue: analytics.overdue
    });

    // Track analytics view usage
    try {
      await user.trackFeatureUsage('analyticsViews');
      console.log("✅ [Analytics] Usage tracked successfully");
    } catch (trackingError) {
      console.error("⚠️ [Analytics] Usage tracking failed:", trackingError);
      // Don't fail the request due to tracking error
    }

    console.log("🚀 [Analytics] About to return successful response");

    const responseData = {
      success: true,
      message: "Analytics data retrieved successfully",
      data: {
        analytics,
        userPlan: user.subscriptionPlan,
        lastUpdated: new Date().toISOString(),
        memberCount: allMembers.length
      }
    };

    console.log("📤 [Analytics] Response data structure:", {
      success: responseData.success,
      message: responseData.message,
      hasAnalytics: !!responseData.data.analytics,
      analyticsKeys: Object.keys(responseData.data.analytics),
      userPlan: responseData.data.userPlan,
      memberCount: responseData.data.memberCount
    });

    return res.status(200).json(responseData);

  } catch (error) {
    console.error("❌ [Analytics] Error:", error);
    console.error("❌ [Analytics] Error stack:", error.stack);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve analytics data",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper function to generate monthly growth data
const generateMonthlyGrowthData = (members, monthsBack = 6) => {
  const now = new Date();
  const monthlyData = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    
    const monthName = monthDate.toLocaleDateString('en-US', { month: 'short' });
    
    const newMembersThisMonth = members.filter(member => {
      const joinDate = new Date(member.joinDate || member.joiningDate);
      return joinDate >= monthDate && joinDate < nextMonthDate;
    }).length;

    monthlyData.push({
      month: monthName,
      value: newMembersThisMonth
    });
  }

  return monthlyData;
};

// Helper function to generate monthly revenue data
const generateMonthlyRevenueData = (members, monthsBack = 6) => {
  const now = new Date();
  const monthlyData = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    
    const monthName = monthDate.toLocaleDateString('en-US', { month: 'short' });
    
    const monthlyRevenue = members.filter(member => {
      const joinDate = new Date(member.joinDate || member.joiningDate);
      return joinDate >= monthDate && joinDate < nextMonthDate;
    }).reduce((sum, member) => {
      const amount = parseFloat(member.feesAmount?.toString().replace(/[^\d.]/g, '') || 0);
      return sum + amount;
    }, 0);

    monthlyData.push({
      month: monthName,
      value: monthlyRevenue
    });
  }

  return monthlyData;
};

// Get member growth trends (for charts)
exports.getMemberGrowthTrends = async (req, res) => {
  try {
    console.log("📈 [Analytics] getMemberGrowthTrends called");
    const userId = req.user.id;
    const { period = '6months' } = req.query;

    const user = await Owner.findById(userId);
    if (!user || !user.hasActiveSubscription()) {
      return res.status(403).json({
        success: false,
        message: "Active subscription required",
        subscriptionRequired: true
      });
    }

    const allMembers = await Member.find({ ownerId: userId });
    
    let monthsBack = 6;
    if (period === '12months') monthsBack = 12;
    if (period === '3months') monthsBack = 3;

    const growthData = generateMonthlyGrowthData(allMembers, monthsBack);
    const revenueData = generateMonthlyRevenueData(allMembers, monthsBack);

    await user.trackFeatureUsage('analyticsViews');

    return res.status(200).json({
      success: true,
      data: {
        growth: growthData,
        revenue: revenueData,
        period,
        totalMembers: allMembers.length
      }
    });

  } catch (error) {
    console.error("Member growth trends error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve growth trends"
    });
  }
};

// Get plan analytics
exports.getPlanAnalytics = async (req, res) => {
  try {
    console.log("📊 [Analytics] getPlanAnalytics called");
    const userId = req.user.id;
    const user = await Owner.findById(userId);

    if (!user || !user.hasActiveSubscription()) {
      return res.status(403).json({
        success: false,
        message: "Active subscription required",
        subscriptionRequired: true
      });
    }

    const allMembers = await Member.find({ ownerId: userId });
    
    // Calculate plan performance metrics
    const planAnalytics = allMembers.reduce((acc, member) => {
      const plan = member.planDuration || 'Unknown';
      const amount = parseFloat(member.feesAmount?.toString().replace(/[^\d.]/g, '') || 0);
      
      if (!acc[plan]) {
        acc[plan] = {
          count: 0,
          totalRevenue: 0,
          activeMembers: 0
        };
      }
      
      acc[plan].count += 1;
      acc[plan].totalRevenue += amount;
      
      if (member.paymentStatus?.toLowerCase() === 'paid') {
        acc[plan].activeMembers += 1;
      }
      
      return acc;
    }, {});

    // Calculate plan performance percentages
    const totalRevenue = Object.values(planAnalytics).reduce((sum, plan) => sum + plan.totalRevenue, 0);
    const planPerformance = Object.keys(planAnalytics).map(planKey => ({
      plan: planKey,
      ...planAnalytics[planKey],
      revenuePercentage: totalRevenue > 0 ? Math.round((planAnalytics[planKey].totalRevenue / totalRevenue) * 100) : 0,
      averageRevenue: planAnalytics[planKey].count > 0 ? Math.round(planAnalytics[planKey].totalRevenue / planAnalytics[planKey].count) : 0
    }));

    await user.trackFeatureUsage('analyticsViews');

    return res.status(200).json({
      success: true,
      data: {
        planPerformance,
        totalPlans: Object.keys(planAnalytics).length,
        totalRevenue,
        mostPopularPlan: planPerformance.reduce((prev, current) => 
          prev.count > current.count ? prev : current, planPerformance[0])?.plan || 'None'
      }
    });

  } catch (error) {
    console.error("Plan analytics error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve plan analytics"
    });
  }
};