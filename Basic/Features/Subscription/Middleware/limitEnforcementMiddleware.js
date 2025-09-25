// middleware/limitEnforcementMiddleware.js

const Owner = require("../../MemberCrud/Models/Owner");

// Check member limit before adding new members
const checkMemberLimit = async (req, res, next) => {
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

        // Check if user can add more members
        if (!user.canAddMember()) {
            const planLimits = user.getPlanLimits();
            const currentCount = user.usageStats.membersCount;
            
            return res.status(403).json({
                success: false,
                message: `Member limit reached (${currentCount}/${planLimits.members}). Upgrade your plan to add more members.`,
                limitReached: true,
                currentUsage: currentCount,
                limit: planLimits.members,
                upgradeRequired: true,
                upgradeUrl: `/payment?plan=ADVANCED&billing=monthly`
            });
        }

        next();
    } catch (error) {
        console.error("Member limit check error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to check member limit"
        });
    }
};

// // Track member addition after successful creation
// const trackMemberAddition = async (req, res, next) => {
//     try {
//         if (!req.user) {
//             return next();
//         }

//         const user = await Owner.findById(req.user.id);
//         if (user) {
//             await user.incrementMemberCount();
//         }

//         next();
//     } catch (error) {
//         console.error("Member addition tracking error:", error);
//         // Don't block the request, just log the error
//         next();
//     }
// };

// In trackMemberAddition middleware (limitEnforcementMiddleware.js)
const trackMemberAddition = async (req, res, next) => {
    try {
        console.log("🔍 trackMemberAddition middleware called");
        
        if (!req.user) {
            console.log("❌ No req.user found");
            return next();
        }

        console.log("📝 Finding user:", req.user.id);
        const user = await Owner.findById(req.user.id);
        
        if (user) {
            console.log("👤 User found, current count:", user.usageStats.membersCount);
            await user.incrementMemberCount();
            console.log("✅ Member count incremented to:", user.usageStats.membersCount);
        } else {
            console.log("❌ User not found");
        }

        next();
    } catch (error) {
        console.error("Member addition tracking error:", error);
        next();
    }
};
// Track member deletion
const trackMemberDeletion = async (req, res, next) => {
    try {
        if (!req.user) {
            return next();
        }

        const user = await Owner.findById(req.user.id);
        if (user) {
            await user.decrementMemberCount();
        }

        next();
    } catch (error) {
        console.error("Member deletion tracking error:", error);
        // Don't block the request, just log the error
        next();
    }
};

// Check feature usage limit (for WhatsApp reminders, analytics, etc.)
const checkFeatureLimit = (featureName) => {
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

            // Check if user can use this feature
            if (!user.canUseFeature(featureName)) {
                const planLimits = user.getPlanLimits();
                const currentUsage = user.usageStats.featureUsage[featureName]?.count || 0;
                
                return res.status(403).json({
                    success: false,
                    message: `${featureName} limit reached (${currentUsage}/${planLimits[featureName]}). Upgrade your plan for more usage.`,
                    limitReached: true,
                    feature: featureName,
                    currentUsage: currentUsage,
                    limit: planLimits[featureName],
                    upgradeRequired: true,
                    upgradeUrl: `/payment?plan=ADVANCED&billing=monthly`
                });
            }

            next();
        } catch (error) {
            console.error(`${featureName} limit check error:`, error);
            return res.status(500).json({
                success: false,
                message: `Failed to check ${featureName} limit`
            });
        }
    };
};

// Track feature usage after successful use
const trackFeatureUsage = (featureName) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return next();
            }

            const user = await Owner.findById(req.user.id);
            if (user) {
                await user.trackFeatureUsage(featureName);
            }

            next();
        } catch (error) {
            console.error(`${featureName} usage tracking error:`, error);
            // Don't block the request, just log the error
            next();
        }
    };
};

module.exports = {
    checkMemberLimit,
    trackMemberAddition,
    trackMemberDeletion,
    checkFeatureLimit,
    trackFeatureUsage
};