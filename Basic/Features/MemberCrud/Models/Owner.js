const mongoose = require("mongoose");

const ownerSchema = new mongoose.Schema(
    {
        firstName: {
            type: String,
            required: true,
            trim: true,
        },
        lastName: {
            type: String,
            required: true,
            trim: true,
        },
        mobileNumber: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
            unique: true,
        },
        password: {
            type: String,
            required: true,
        },
        accountType: {
            type: String,
            default: "owner",
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        otp: {
            type: String,
        },
        otpExpires: {
            type: Date,
        },
        
        // NEW: GYM DETAILS FOR ONBOARDING
        gymDetails: {
            gymName: {
                type: String,
                trim: true,
                default: null
            },
            gymLogo: {
                type: String, // Base64 string or URL
                default: null
            },
            isOnboardingComplete: {
                type: Boolean,
                default: false
            },
            onboardingCompletedAt: {
                type: Date,
                default: null
            }
        },
        
        // EXISTING SUBSCRIPTION FIELDS
        subscriptionPlan: {
            type: String,
            enum: ["NONE", "BASIC", "ADVANCED", "ENTERPRISE"],
            default: "NONE",
        },
        subscriptionExpiry: {
            type: Date,
            default: null,
        },
        
        // EXISTING BILLING CYCLE TRACKING
        billingCycle: {
            startDate: {
                type: Date,
                default: Date.now
            },
            nextResetDate: {
                type: Date,
                default: function() {
                    return new Date(Date.now() + (30 * 24 * 60 * 60 * 1000));
                }
            },
            billingDay: {
                type: Number,
                default: function() {
                    return new Date().getDate();
                }
            },
            lastResetDate: {
                type: Date,
                default: Date.now
            },
            cycleType: {
                type: String,
                enum: ["monthly", "quarterly", "half-yearly", "yearly"],
                default: "monthly"
            },
            cycleDuration: {
                type: Number,
                default: 1
            }
        },
        
        // EXISTING PAYMENT HISTORY
        paymentHistory: [{
            orderId: String,
            paymentId: String,
            amount: Number,
            currency: String,
            billing: {
                type: String,
                enum: ["monthly", "quarterly", "half-yearly", "yearly"],
                default: "monthly"
            },
            cycleDuration: {
                type: Number, 
                default: 1
            },
            status: {
                type: String,
                enum: ["SUCCESS", "FAILED", "PENDING"]
            },
            plan: String,
            createdAt: {
                type: Date,
                default: Date.now
            }
        }],
        
        // EXISTING USAGE TRACKING
        usageStats: {
            membersCount: {
                type: Number,
                default: 0
            },
            lastMemberCountUpdate: {
                type: Date,
                default: Date.now
            },
            featureUsage: {
                whatsappReminders: {
                    count: { type: Number, default: 0 },
                    lastUsed: { type: Date }
                },
                analyticsViews: {
                    count: { type: Number, default: 0 },
                    lastUsed: { type: Date }
                },
                searchQueries: {
                    count: { type: Number, default: 0 },
                    lastUsed: { type: Date }
                }
            },
            monthlyStats: [{
                cycleId: String,
                cycleStart: Date,
                cycleEnd: Date,
                membersAdded: { type: Number, default: 0 },
                featuresUsed: {
                    whatsappReminders: { type: Number, default: 0 },
                    analyticsViews: { type: Number, default: 0 },
                    searchQueries: { type: Number, default: 0 }
                }
            }]
        },
        
        // EXISTING NOTIFICATION TRACKING
        notificationSettings: {
            expiryReminders: {
                enabled: { type: Boolean, default: true },
                emailSent7Days: { type: Boolean, default: false },
                emailSent3Days: { type: Boolean, default: false },
                emailSentExpiry: { type: Boolean, default: false },
                emailSentPostExpiry: { type: Boolean, default: false }
            }
        }
    },
    { timestamps: true }
);

// NEW: GYM ONBOARDING METHODS
ownerSchema.methods.completeOnboarding = function(gymName, gymLogo) {
    this.gymDetails.gymName = gymName;
    this.gymDetails.gymLogo = gymLogo;
    this.gymDetails.isOnboardingComplete = true;
    this.gymDetails.onboardingCompletedAt = new Date();
    return this.save();
};

ownerSchema.methods.needsOnboarding = function() {
    return !this.gymDetails.isOnboardingComplete;
};

ownerSchema.methods.getGymInfo = function() {
    return {
        gymName: this.gymDetails.gymName || 'IRON THRONE',
        gymLogo: this.gymDetails.gymLogo,
        isOnboardingComplete: this.gymDetails.isOnboardingComplete
    };
};

// EXISTING METHODS - UNCHANGED
ownerSchema.methods.hasActiveSubscription = function() {
    if (this.subscriptionPlan === "NONE") return false;
    if (!this.subscriptionExpiry) return false;
    return new Date() < this.subscriptionExpiry;
};

ownerSchema.methods.getSubscriptionStatus = function() {
    if (this.subscriptionPlan === "NONE") {
        return { 
            isActive: false, 
            plan: "NONE", 
            expiry: null, 
            needsSubscription: true 
        };
    }
    
    const isActive = this.hasActiveSubscription();
    return {
        isActive,
        plan: this.subscriptionPlan,
        expiry: this.subscriptionExpiry,
        needsSubscription: !isActive,
        daysLeft: isActive ? Math.ceil((this.subscriptionExpiry - new Date()) / (1000 * 60 * 60 * 24)) : 0
    };
};

// EXISTING BILLING METHODS
ownerSchema.methods.calculateNextResetDate = function(billingType = "monthly") {
    const startDate = this.billingCycle.startDate || new Date();
    const nextReset = new Date(startDate);
    
    const durationMap = {
        "monthly": 1,
        "quarterly": 3,
        "half-yearly": 6,
        "yearly": 12
    };
    
    const monthsToAdd = durationMap[billingType] || 1;
    nextReset.setMonth(startDate.getMonth() + monthsToAdd);
    
    if (nextReset.getDate() !== startDate.getDate()) {
        nextReset.setDate(0);
    }
    
    return nextReset;
};

ownerSchema.methods.shouldResetUsage = function() {
    const now = new Date();
    return now >= this.billingCycle.nextResetDate;
};

ownerSchema.methods.initializeBillingCycle = function(billingType = "monthly") {
    const now = new Date();
    const durationMap = {
        "monthly": 1,
        "quarterly": 3,
        "half-yearly": 6,
        "yearly": 12
    };
    
    this.billingCycle.startDate = now;
    this.billingCycle.lastResetDate = now;
    this.billingCycle.billingDay = now.getDate();
    this.billingCycle.cycleType = billingType;
    this.billingCycle.cycleDuration = durationMap[billingType];
    this.billingCycle.nextResetDate = this.calculateNextResetDate(billingType);
};

// EXISTING USAGE METHODS - ALL UNCHANGED
ownerSchema.methods.resetUsageCycle = function() {
    const now = new Date();
    const oldResetDate = this.billingCycle.nextResetDate;
    
    const cycleId = `${this.billingCycle.lastResetDate.toISOString().substring(0, 10)}_${oldResetDate.toISOString().substring(0, 10)}`;
    
    this.usageStats.monthlyStats.push({
        cycleId: cycleId,
        cycleStart: this.billingCycle.lastResetDate,
        cycleEnd: oldResetDate,
        membersAdded: this.usageStats.membersCount,
        featuresUsed: {
            whatsappReminders: this.usageStats.featureUsage.whatsappReminders.count,
            analyticsViews: this.usageStats.featureUsage.analyticsViews.count,
            searchQueries: this.usageStats.featureUsage.searchQueries.count
        }
    });
    
    this.usageStats.monthlyStats = this.usageStats.monthlyStats
        .sort((a, b) => new Date(b.cycleStart) - new Date(a.cycleStart))
        .slice(0, 12);
    
    this.usageStats.featureUsage.whatsappReminders.count = 0;
    this.usageStats.featureUsage.analyticsViews.count = 0;
    this.usageStats.featureUsage.searchQueries.count = 0;
    
    this.billingCycle.lastResetDate = oldResetDate;
    this.billingCycle.nextResetDate = this.calculateNextResetDate(this.billingCycle.cycleType);
};

ownerSchema.methods.incrementMemberCount = async function() {
    this.usageStats.membersCount += 1;
    this.usageStats.lastMemberCountUpdate = new Date();
    
    const currentCycle = this.usageStats.monthlyStats[this.usageStats.monthlyStats.length - 1];
    if (currentCycle && currentCycle.cycleEnd > new Date()) {
        currentCycle.membersAdded += 1;
    }
    
    return await this.save();
};

ownerSchema.methods.decrementMemberCount = async function() {
    if (this.usageStats.membersCount > 0) {
        this.usageStats.membersCount -= 1;
        this.usageStats.lastMemberCountUpdate = new Date();
        return await this.save();
    }
};

ownerSchema.methods.trackFeatureUsage = async function(featureName) {
    const validFeatures = ['whatsappReminders', 'analyticsViews', 'searchQueries'];
    if (!validFeatures.includes(featureName)) return;
    
    this.usageStats.featureUsage[featureName].count += 1;
    this.usageStats.featureUsage[featureName].lastUsed = new Date();
    
    const currentCycle = this.usageStats.monthlyStats[this.usageStats.monthlyStats.length - 1];
    if (currentCycle && currentCycle.cycleEnd > new Date()) {
        currentCycle.featuresUsed[featureName] += 1;
    }
    
    return await this.save();
};

ownerSchema.methods.getPlanLimits = function() {
    const planLimits = {
        NONE: {
            members: 0,
            whatsappReminders: 0,
            analyticsViews: 0,
            searchQueries: 0,
            features: []
        },
        BASIC: {
            members: 150,
            whatsappReminders: 1000,
            analyticsViews: 500,
            searchQueries: 1000,
            features: [
                "Up to 150 members",
                "Member dashboard with profiles & photos",
                "Add & search active members", 
                "Due notifications to owner",
                "Basic fee tracking & payment status",
                "Member contact details & emergency info",
                "Basic analytics reports",
                "Data backup & security",
                "24/7 chat & email support"
            ]
        },
        ADVANCED: {
            members: 400,
            whatsappReminders: 5000,
            analyticsViews: 2000,
            searchQueries: 5000,
            features: [
                "Up to 400 members",
                "Powered by every feature of the Basic Plan, and more",
                "Automated WhatsApp notifications",
                "Predictive fee tracking & insights", 
                "Inactive member alerts (track who hasn't visited)",
                "Advanced analytics (growth + revenue trends)",
                "Bulk WhatsApp messaging for announcements",
                "Equipment maintenance reminders",
                "Expense tracking (basic)",
                "Priority phone + chat support"
            ]
        },
        ENTERPRISE: {
            members: -1,
            whatsappReminders: -1,
            analyticsViews: -1,
            searchQueries: -1,
            features: [
                "Unlimited members (no cap)",
                "Powered by every feature of the Advanced Plan, and more",
                "Manage multiple branches/locations from one dashboard",
                "Automated daily WhatsApp reports (joins, renewals, dues, inactive)",
                "Smart WhatsApp fee reminders (3 days before + due date with QR)",
                "Member birthday & anniversary notifications",
                "Advanced expense & profit tracking",
                "Automated class scheduling & booking system",
                "Advanced security & compliance features",
                "Dedicated success manager (priority WhatsApp + phone support)",
                "Early access to new premium features"
            ]
        }
    };
    
    return planLimits[this.subscriptionPlan] || planLimits.NONE;
};

ownerSchema.methods.canAddMember = function() {
    const limits = this.getPlanLimits();
    if (limits.members === -1) return true;
    return this.usageStats.membersCount < limits.members;
};

ownerSchema.methods.canUseFeature = function(featureName) {
    const limits = this.getPlanLimits();
    if (limits[featureName] === -1) return true;
    return this.usageStats.featureUsage[featureName].count < limits[featureName];
};

ownerSchema.methods.getUsagePercentage = function(type) {
    const limits = this.getPlanLimits();
    if (limits[type] === -1) return 0;
    
    let current = 0;
    if (type === 'members') {
        current = this.usageStats.membersCount;
    } else {
        current = this.usageStats.featureUsage[type]?.count || 0;
    }
    
    return Math.min((current / limits[type]) * 100, 100);
};

ownerSchema.methods.getBillingCycleStatus = function() {
    const now = new Date();
    const daysUntilReset = Math.ceil((this.billingCycle.nextResetDate - now) / (1000 * 60 * 60 * 24));
    const totalCycleDays = this.billingCycle.cycleDuration * 30;
    const daysSinceReset = Math.max(totalCycleDays - daysUntilReset, 0);
    
    return {
        nextResetDate: this.billingCycle.nextResetDate,
        daysUntilReset: Math.max(daysUntilReset, 0),
        cycleProgress: Math.min((daysSinceReset / totalCycleDays) * 100, 100),
        cycleType: this.billingCycle.cycleType,
        cycleDuration: this.billingCycle.cycleDuration,
        shouldReset: this.shouldResetUsage()
    };
};

module.exports = mongoose.model("Owner", ownerSchema);