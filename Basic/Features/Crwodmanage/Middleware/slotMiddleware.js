const jwt = require("jsonwebtoken");
const Owner = require("../../MemberCrud/Models/Owner");
const Member = require("../../MemberCrud/Models/Member");

// ===== ADVANCED PLAN CHECK MIDDLEWARE =====
const checkAdvancedPlan = async (req, res, next) => {
    try {
        console.log("🎯 Checking Advanced Plan Access for Slot Booking...");
        
        // Get owner from request (should be set by auth middleware)
        const ownerId = req.user?.id;
        if (!ownerId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required for slot booking",
                errorCode: "AUTH_REQUIRED"
            });
        }
        
        // Fetch owner details
        const owner = await Owner.findById(ownerId);
        if (!owner) {
            return res.status(404).json({
                success: false,
                message: "Owner account not found",
                errorCode: "OWNER_NOT_FOUND"
            });
        }
        
        // Check if subscription is active
        const subscriptionStatus = owner.getSubscriptionStatus();
        if (!subscriptionStatus.isActive) {
            return res.status(403).json({
                success: false,
                message: "Active subscription required for crowd management and slot booking features",
                needsSubscription: true,
                currentPlan: owner.subscriptionPlan,
                errorCode: "SUBSCRIPTION_EXPIRED",
                upgradeUrl: "/pricing",
                feature: "Slot Booking & Crowd Management"
            });
        }
        
        // Check if plan is ADVANCED or ENTERPRISE (slot booking exclusive feature)
        if (!["ADVANCED", "ENTERPRISE"].includes(owner.subscriptionPlan)) {
            return res.status(403).json({
                success: false,
                message: "Crowd Management & Slot Booking is exclusively available for Advanced and Enterprise plans",
                currentPlan: owner.subscriptionPlan,
                requiredPlan: "ADVANCED",
                needsUpgrade: true,
                errorCode: "PLAN_UPGRADE_REQUIRED",
                upgradeUrl: "/pricing",
                features: [
                    "Smart crowd management dashboard",
                    "Automated slot booking via WhatsApp",
                    "Real-time capacity monitoring", 
                    "Member check-in/check-out tracking",
                    "Previous slot auto-assignment",
                    "Congestion alerts and analytics"
                ]
            });
        }
        
        console.log(`✅ Advanced plan verified for slot booking: ${owner.firstName} (${owner.subscriptionPlan})`);
        
        // Initialize slot settings if not present
        if (!owner.slotSettings) {
            owner.slotSettings = {
                defaultCapacity: 20,
                slotSpecificCapacity: {},
                enableAutoReminders: true,
                reminderTime: "07:00", // 7 AM
                enablePreviousSlotLogic: true,
                warningThreshold: 3
            };
            await owner.save();
        }
        
        // Add owner details to request for further use
        req.ownerDetails = owner;
        next();
        
    } catch (error) {
        console.error("❌ Advanced plan check error:", error);
        return res.status(500).json({
            success: false,
            message: "Error verifying plan access for slot booking"
        });
    }
};

// ===== JWT TOKEN VALIDATION FOR SLOT BOOKING LINKS =====
const validateSlotBookingToken = async (req, res, next) => {
    try {
        console.log("🔑 Validating slot booking JWT token...");
        
        // Get token from query params or body
        const token = req.query.token || req.body.token;
        
        if (!token) {
            return res.status(400).json({
                success: false,
                message: "Slot booking token is required. Please use the link from WhatsApp message.",
                errorCode: "TOKEN_MISSING",
                instructions: "Check your WhatsApp for today's booking link"
            });
        }
        
        // Verify JWT token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (jwtError) {
            console.error("JWT verification failed:", jwtError.message);
            
            if (jwtError.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    message: "Your booking link has expired. Please wait for tomorrow's WhatsApp message.",
                    errorCode: "TOKEN_EXPIRED",
                    nextAction: "Wait for tomorrow's booking link via WhatsApp"
                });
            }
            
            return res.status(401).json({
                success: false,
                message: "Invalid or corrupted booking link. Please use the latest link from WhatsApp.",
                errorCode: "TOKEN_INVALID"
            });
        }
        
        // Validate token structure for slot booking
        const { memberId, ownerId, date, type, memberName } = decoded;
        
        if (!memberId || !ownerId || !date || type !== 'slot_booking') {
            return res.status(401).json({
                success: false,
                message: "Invalid token format. This link is not for slot booking.",
                errorCode: "TOKEN_MALFORMED"
            });
        }
        
        // Check if token is for today's date
        const tokenDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        tokenDate.setHours(0, 0, 0, 0);
        
        if (tokenDate.getTime() !== today.getTime()) {
            const isForTomorrow = tokenDate.getTime() === (today.getTime() + 24 * 60 * 60 * 1000);
            
            return res.status(401).json({
                success: false,
                message: isForTomorrow 
                    ? "This booking link is for tomorrow. Please wait until tomorrow to book your slot."
                    : "This booking link is not valid for today. Please use today's link from WhatsApp.",
                errorCode: "TOKEN_DATE_MISMATCH",
                tokenDate: tokenDate.toISOString().split('T')[0],
                todayDate: today.toISOString().split('T')[0]
            });
        }
        
        // Verify member exists and belongs to the owner
        const member = await Member.findOne({
            _id: memberId,
            ownerId: ownerId
        });
        
        if (!member) {
            return res.status(404).json({
                success: false,
                message: "Member not found or access denied. You may have been removed from this gym.",
                errorCode: "MEMBER_NOT_FOUND"
            });
        }
        
        // Verify member is active (paid status)
        if (member.paymentStatus !== 'Paid') {
            return res.status(403).json({
                success: false,
                message: "Your membership payment is pending. Please contact gym owner to activate slot booking.",
                errorCode: "PAYMENT_PENDING",
                memberStatus: member.paymentStatus
            });
        }
        
        // Verify owner still has advanced plan and active subscription
        const owner = await Owner.findById(ownerId);
        if (!owner || !["ADVANCED", "ENTERPRISE"].includes(owner.subscriptionPlan)) {
            return res.status(403).json({
                success: false,
                message: "Slot booking feature is no longer available for this gym. Please contact gym owner.",
                errorCode: "FEATURE_DISABLED"
            });
        }
        
        // Check if owner has active subscription
        const subscriptionStatus = owner.getSubscriptionStatus();
        if (!subscriptionStatus.isActive) {
            return res.status(403).json({
                success: false,
                message: "Gym subscription has expired. Slot booking is temporarily unavailable. Please contact gym owner.",
                errorCode: "GYM_SUBSCRIPTION_EXPIRED"
            });
        }
        
        console.log(`✅ Token validated for slot booking: ${member.name} (${member.phoneNo})`);
        
        // Add member and owner details to request
        req.memberDetails = member;
        req.ownerDetails = owner;
        req.tokenData = decoded;
        req.validToken = token;
        
        next();
        
    } catch (error) {
        console.error("❌ Token validation error:", error);
        return res.status(500).json({
            success: false,
            message: "Error validating booking token"
        });
    }
};

// ===== SLOT BOOKING TIME VALIDATION =====
const validateBookingTime = (req, res, next) => {
    try {
        console.log("⏰ Validating booking time restrictions...");
        
        // Check if booking is within allowed time (configurable per gym)
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        // Default booking hours: 5:00 AM to 11:30 PM
        const startHour = 5;
        const endHour = 23;
        const endMinute = 30;
        
        // Check if current time is within booking window
        const isBeforeStart = currentHour < startHour;
        const isAfterEnd = currentHour > endHour || (currentHour === endHour && currentMinute > endMinute);
        
        if (isBeforeStart || isAfterEnd) {
            return res.status(400).json({
                success: false,
                message: "Slot booking is only available between 5:00 AM and 11:30 PM",
                errorCode: "BOOKING_TIME_RESTRICTED",
                allowedHours: "5:00 AM - 11:30 PM",
                currentTime: now.toLocaleTimeString(),
                nextAvailable: isAfterEnd ? "5:00 AM tomorrow" : "5:00 AM today"
            });
        }
        
        // Additional validation: don't allow booking for past slots
        const { slotTime } = req.body;
        if (slotTime) {
            const [startTime] = slotTime.split('-');
            const [hours, minutes] = startTime.split(':');
            const slotDateTime = new Date();
            slotDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            
            // Allow booking until 30 minutes before slot starts
            const timeDiff = slotDateTime.getTime() - now.getTime();
            const minutesDiff = timeDiff / (1000 * 60);
            
            if (minutesDiff < 30) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot book slot ${slotTime} as it starts in less than 30 minutes`,
                    errorCode: "SLOT_TOO_SOON",
                    minimumAdvanceTime: "30 minutes"
                });
            }
        }
        
        console.log("✅ Booking time validation passed");
        next();
        
    } catch (error) {
        console.error("❌ Booking time validation error:", error);
        return res.status(500).json({
            success: false,
            message: "Error validating booking time"
        });
    }
};

// ===== MEMBER ACCESS CHECK FOR SLOT BOOKING =====
const checkMemberSlotAccess = async (req, res, next) => {
    try {
        console.log("👤 Checking member slot access permissions...");
        
        // This middleware is for when members access slot booking directly
        // (not through JWT token validation)
        
        const memberId = req.params.memberId || req.body.memberId;
        const ownerId = req.params.ownerId;
        
        if (!memberId && !ownerId) {
            return res.status(400).json({
                success: false,
                message: "Member ID and Owner ID are required",
                errorCode: "MISSING_IDENTIFIERS"
            });
        }
        
        // Get member details
        const member = await Member.findById(memberId);
        if (!member) {
            return res.status(404).json({
                success: false,
                message: "Member not found",
                errorCode: "MEMBER_NOT_FOUND"
            });
        }
        
        // Get owner details
        const owner = await Owner.findById(ownerId || member.ownerId);
        if (!owner) {
            return res.status(404).json({
                success: false,
                message: "Gym owner not found",
                errorCode: "OWNER_NOT_FOUND"
            });
        }
        
        // Verify member belongs to this owner
        if (member.ownerId.toString() !== owner._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Member does not belong to this gym.",
                errorCode: "MEMBER_OWNER_MISMATCH"
            });
        }
        
        // Check if owner has advanced plan
        if (!["ADVANCED", "ENTERPRISE"].includes(owner.subscriptionPlan)) {
            return res.status(403).json({
                success: false,
                message: "Slot booking feature is not available for your gym. Please ask gym owner to upgrade to Advanced plan.",
                currentPlan: owner.subscriptionPlan,
                requiredPlan: "ADVANCED",
                errorCode: "FEATURE_NOT_AVAILABLE",
                upgradeMessage: "Ask your gym owner to upgrade for slot booking access"
            });
        }
        
        // Check if owner has active subscription
        const subscriptionStatus = owner.getSubscriptionStatus();
        if (!subscriptionStatus.isActive) {
            return res.status(403).json({
                success: false,
                message: "Gym subscription has expired. Slot booking is temporarily unavailable. Please contact gym owner.",
                errorCode: "GYM_SUBSCRIPTION_EXPIRED",
                expiryDate: owner.subscriptionExpiry
            });
        }
        
        // Check member payment status
        if (member.paymentStatus !== 'Paid') {
            return res.status(403).json({
                success: false,
                message: "Your membership payment is pending. Please contact gym owner to activate slot booking.",
                errorCode: "MEMBER_PAYMENT_PENDING",
                paymentStatus: member.paymentStatus
            });
        }
        
        console.log(`✅ Member slot access verified: ${member.name} for ${owner.firstName}'s gym`);
        
        // Add details to request
        req.memberDetails = member;
        req.ownerDetails = owner;
        
        next();
        
    } catch (error) {
        console.error("❌ Member slot access check error:", error);
        return res.status(500).json({
            success: false,
            message: "Error verifying member access"
        });
    }
};

// ===== CAPACITY CHECK MIDDLEWARE =====
const checkSlotCapacity = async (req, res, next) => {
    try {
        console.log("📊 Checking slot capacity before booking...");
        
        const { slotTime } = req.body;
        const { ownerDetails } = req;
        
        if (!slotTime || !ownerDetails) {
            return next(); // Skip if no slot time or owner details
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const SlotBooking = require("../models/SlotBooking");
        
        // Check current slot availability
        const availability = await SlotBooking.checkSlotAvailability(
            ownerDetails._id, 
            today, 
            slotTime
        );
        
        if (!availability.isAvailable) {
            const capacityStatus = await SlotBooking.prototype.getSlotCapacityStatus.call({
                ownerId: ownerDetails._id,
                bookingDate: today,
                slotTime: slotTime
            });
            
            return res.status(400).json({
                success: false,
                message: `Slot ${slotTime} is fully booked (${availability.currentBookings}/${availability.maxCapacity})`,
                errorCode: "SLOT_FULL",
                slotTime,
                capacityInfo: capacityStatus,
                suggestion: "Please select a different time slot"
            });
        }
        
        console.log(`✅ Slot capacity check passed: ${availability.availableSpots} spots available`);
        
        // Add availability info to request
        req.slotAvailability = availability;
        next();
        
    } catch (error) {
        console.error("❌ Slot capacity check error:", error);
        return res.status(500).json({
            success: false,
            message: "Error checking slot capacity"
        });
    }
};

// ===== CROWD MANAGEMENT ACCESS MIDDLEWARE =====
const checkCrowdManagementAccess = async (req, res, next) => {
    try {
        console.log("🏢 Verifying crowd management dashboard access...");
        
        // This middleware is specifically for crowd management features
        const ownerId = req.user?.id;
        
        if (!ownerId) {
            return res.status(401).json({
                success: false,
                message: "Owner authentication required for crowd management",
                errorCode: "AUTH_REQUIRED"
            });
        }
        
        const owner = await Owner.findById(ownerId);
        if (!owner) {
            return res.status(404).json({
                success: false,
                message: "Owner account not found",
                errorCode: "OWNER_NOT_FOUND"
            });
        }
        
        // Check subscription and plan
        const subscriptionStatus = owner.getSubscriptionStatus();
        if (!subscriptionStatus.isActive) {
            return res.status(403).json({
                success: false,
                message: "Active subscription required for crowd management dashboard",
                errorCode: "SUBSCRIPTION_REQUIRED",
                feature: "Crowd Management Dashboard"
            });
        }
        
        if (!["ADVANCED", "ENTERPRISE"].includes(owner.subscriptionPlan)) {
            return res.status(403).json({
                success: false,
                message: "Crowd Management Dashboard is exclusive to Advanced and Enterprise plans",
                currentPlan: owner.subscriptionPlan,
                requiredPlan: "ADVANCED",
                errorCode: "PLAN_UPGRADE_REQUIRED",
                features: [
                    "Real-time crowd monitoring",
                    "Slot capacity management", 
                    "Member check-in tracking",
                    "Congestion analytics",
                    "Automated WhatsApp reminders"
                ]
            });
        }
        
        console.log(`✅ Crowd management access verified for: ${owner.firstName}`);
        req.ownerDetails = owner;
        next();
        
    } catch (error) {
        console.error("❌ Crowd management access check error:", error);
        return res.status(500).json({
            success: false,
            message: "Error verifying crowd management access"
        });
    }
};

module.exports = {
    checkAdvancedPlan,
    validateSlotBookingToken,
    validateBookingTime,
    checkMemberSlotAccess,
    checkSlotCapacity,
    checkCrowdManagementAccess
};