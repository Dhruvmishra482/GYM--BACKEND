const express = require("express");
const { body, param, query, validationResult } = require("express-validator");

// Import slot controllers
const {
    // Member slot booking functions
    getSlotBookingPage,
    bookSlot,
    getSlotAvailability,
    getMemberSlotHistory,
    cancelSlotBooking,
    
    // Owner crowd management functions
    getCrowdManagementDashboard,
    getOwnerSlotDashboard,
    manualSlotBooking,
    updateSlotCapacity,
    sendSlotReminders,
    getSlotStatistics,
    
    // Member check-in/out functions
    // memberCheckIn,
    // memberCheckOut,
    // getSlotAttendance,
    
    // WhatsApp automation functions
    sendDailySlotReminders,
    testSlotReminderMessage,
    
    // Analytics functions
    getCrowdAnalytics,
    getSlotTrends,
    exportSlotData
} = require("../Controllers/slotController");

// Import existing auth middleware
const { auth, isOwner } = require("../../Auth/Middleware/authMiddleware");

// Import subscription middleware
const { isSubscribed, checkSubscriptionExpiry } = require("../../Subscription/Middleware/subscriptionMiddleware");

// Import slot-specific middleware
const {
    checkAdvancedPlan,
    validateSlotBookingToken,
    validateBookingTime,
    checkMemberSlotAccess,
    checkSlotCapacity,
    checkCrowdManagementAccess
} = require("../Middleware/slotMiddleware");

const router = express.Router();

// Validation middleware
const validate = (validations) => async (req, res, next) => {
    await Promise.all(validations.map((v) => v.run(req)));
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();
    return res.status(400).json({ 
        success: false, 
        message: "Validation failed",
        errors: errors.array() 
    });
};

// ===== MEMBER SLOT BOOKING ROUTES =====

// Get slot booking page (accessed via WhatsApp JWT link)
router.get("/book",
    validateSlotBookingToken,
    validateBookingTime,
    getSlotBookingPage
);

// Book a slot (POST request from booking page)
router.post("/book",
    validate([
        body("token").notEmpty().withMessage("Booking token is required"),
        body("slotTime").notEmpty().withMessage("Slot time is required")
            .isIn([
                "06:00-07:00", "07:00-08:00", "08:00-09:00", "09:00-10:00", "10:00-11:00",
                "11:00-12:00", "12:00-13:00", "13:00-14:00", "14:00-15:00", "15:00-16:00",
                "16:00-17:00", "17:00-18:00", "18:00-19:00", "19:00-20:00", "20:00-21:00",
                "21:00-22:00"
            ]).withMessage("Invalid slot time"),
        body("date").optional().isISO8601().withMessage("Invalid date format")
    ]),
    validateSlotBookingToken,
    validateBookingTime,
    checkSlotCapacity,
    bookSlot
);

// Cancel slot booking
router.delete("/book/:bookingId",
    validate([
        param("bookingId").isMongoId().withMessage("Invalid booking ID")
    ]),
    validateSlotBookingToken,
    cancelSlotBooking
);

// Get slot availability for a specific date (public endpoint for members)
router.get("/availability/:ownerId/:date",
    validate([
        param("ownerId").isMongoId().withMessage("Invalid owner ID"),
        param("date").isISO8601().withMessage("Invalid date format")
    ]),
    checkMemberSlotAccess,
    getSlotAvailability
);

// Get member's slot booking history
router.get("/member/:memberId/history",
    validate([
        param("memberId").isMongoId().withMessage("Invalid member ID"),
        query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
        query("page").optional().isInt({ min: 1 }).withMessage("Page must be greater than 0")
    ]),
    checkMemberSlotAccess,
    getMemberSlotHistory
);

// // ===== MEMBER CHECK-IN/OUT ROUTES =====

// // Member check-in to slot
// router.post("/checkin",
//     validate([
//         body("token").notEmpty().withMessage("Booking token is required"),
//         body("bookingId").optional().isMongoId().withMessage("Invalid booking ID")
//     ]),
//     validateSlotBookingToken,
//     memberCheckIn
// );

// // Member check-out from slot
// router.post("/checkout",
//     validate([
//         body("token").notEmpty().withMessage("Booking token is required"),
//         body("bookingId").optional().isMongoId().withMessage("Invalid booking ID")
//     ]),
//     validateSlotBookingToken,
//     memberCheckOut
// );

// ===== OWNER CROWD MANAGEMENT ROUTES =====

// Get crowd management dashboard (main dashboard for owners)
router.get("/crowd-dashboard",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    checkAdvancedPlan,
    validate([
        query("date").optional().isISO8601().withMessage("Invalid date format")
    ]),
    getCrowdManagementDashboard
);

// Get owner slot dashboard (live slot counts - legacy endpoint)
router.get("/dashboard",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    checkAdvancedPlan,
    validate([
        query("date").optional().isISO8601().withMessage("Invalid date format")
    ]),
    getOwnerSlotDashboard
);

// Manual slot booking (by owner for walk-in members)
router.post("/manual-book",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    checkAdvancedPlan,
    validate([
        body("memberId").isMongoId().withMessage("Invalid member ID"),
        body("slotTime").notEmpty().withMessage("Slot time is required")
            .isIn([
                "06:00-07:00", "07:00-08:00", "08:00-09:00", "09:00-10:00", "10:00-11:00",
                "11:00-12:00", "12:00-13:00", "13:00-14:00", "14:00-15:00", "15:00-16:00",
                "16:00-17:00", "17:00-18:00", "18:00-19:00", "19:00-20:00", "20:00-21:00",
                "21:00-22:00"
            ]).withMessage("Invalid slot time"),
        body("date").optional().isISO8601().withMessage("Invalid date format")
    ]),
    manualSlotBooking
);

// Update slot capacity settings
router.patch("/settings/capacity",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    checkAdvancedPlan,
    validate([
        body("defaultCapacity").optional().isInt({ min: 5, max: 100 })
            .withMessage("Default capacity must be between 5 and 100"),
        body("slotSpecificCapacity").optional().isObject()
            .withMessage("Slot specific capacity must be an object"),
        body("slotTime").optional().isIn([
            "06:00-07:00", "07:00-08:00", "08:00-09:00", "09:00-10:00", "10:00-11:00",
            "11:00-12:00", "12:00-13:00", "13:00-14:00", "14:00-15:00", "15:00-16:00",
            "16:00-17:00", "17:00-18:00", "18:00-19:00", "19:00-20:00", "20:00-21:00",
            "21:00-22:00"
        ]).withMessage("Invalid slot time"),
        body("capacity").optional().isInt({ min: 1, max: 100 })
            .withMessage("Capacity must be between 1 and 100")
    ]),
    updateSlotCapacity
);

// // Get slot attendance for specific date
// router.get("/attendance/:date",
//     auth,
//     isOwner,
//     checkSubscriptionExpiry,
//     isSubscribed,
//     checkAdvancedPlan,
//     validate([
//         param("date").isISO8601().withMessage("Invalid date format")
//     ]),
//     getSlotAttendance
// );

// ===== WHATSAPP AUTOMATION ROUTES =====

// Send slot booking reminders manually
router.post("/send-reminders",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    checkAdvancedPlan,
    validate([
        body("targetDate").optional().isISO8601().withMessage("Invalid target date format"),
        body("memberIds").optional().isArray().withMessage("Member IDs must be an array"),
        body("testMode").optional().isBoolean().withMessage("Test mode must be boolean")
    ]),
    sendSlotReminders
);

// Send daily slot reminders (automated endpoint)
router.post("/send-daily-reminders",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    checkAdvancedPlan,
    sendDailySlotReminders
);

// Test slot reminder message format
router.post("/test-reminder",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    checkAdvancedPlan,
    validate([
        body("memberId").isMongoId().withMessage("Invalid member ID"),
        body("testPhoneNumber").optional().isMobilePhone().withMessage("Invalid phone number")
    ]),
    testSlotReminderMessage
);

// ===== ANALYTICS & STATISTICS ROUTES =====

// Get slot statistics and analytics
router.get("/statistics",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    checkAdvancedPlan,
    validate([
        query("startDate").optional().isISO8601().withMessage("Invalid start date format"),
        query("endDate").optional().isISO8601().withMessage("Invalid end date format"),
        query("period").optional().isIn(["week", "month", "quarter", "year"])
            .withMessage("Period must be week, month, quarter, or year")
    ]),
    getSlotStatistics
);

// Get crowd analytics with trends
router.get("/analytics/crowd",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    checkAdvancedPlan,
    validate([
        query("period").optional().isIn(["week", "month", "quarter"])
            .withMessage("Period must be week, month, or quarter"),
        query("slotTime").optional().isIn([
            "06:00-07:00", "07:00-08:00", "08:00-09:00", "09:00-10:00", "10:00-11:00",
            "11:00-12:00", "12:00-13:00", "13:00-14:00", "14:00-15:00", "15:00-16:00",
            "16:00-17:00", "17:00-18:00", "18:00-19:00", "19:00-20:00", "20:00-21:00",
            "21:00-22:00"
        ]).withMessage("Invalid slot time filter")
    ]),
    getCrowdAnalytics
);

// Get slot booking trends
router.get("/analytics/trends",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    checkAdvancedPlan,
    validate([
        query("type").optional().isIn(["daily", "weekly", "monthly"])
            .withMessage("Trend type must be daily, weekly, or monthly"),
        query("days").optional().isInt({ min: 7, max: 365 })
            .withMessage("Days must be between 7 and 365")
    ]),
    getSlotTrends
);

// Export slot data (CSV/Excel)
router.get("/export",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    checkAdvancedPlan,
    validate([
        query("format").optional().isIn(["csv", "excel"]).withMessage("Format must be csv or excel"),
        query("startDate").optional().isISO8601().withMessage("Invalid start date"),
        query("endDate").optional().isISO8601().withMessage("Invalid end date"),
        query("includeMembers").optional().isBoolean().withMessage("Include members must be boolean")
    ]),
    exportSlotData
);

// Get specific date slot details
router.get("/details/:date",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    checkAdvancedPlan,
    validate([
        param("date").isISO8601().withMessage("Invalid date format")
    ]),
    getSlotAvailability
);

// ===== ADMIN/DEBUG ROUTES =====

// Get all slot bookings (for debugging - owner only)
router.get("/all-bookings",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    checkAdvancedPlan,
    validate([
        query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
        query("page").optional().isInt({ min: 1 }).withMessage("Page must be greater than 0"),
        query("status").optional().isIn(["CONFIRMED", "CANCELLED", "NO_SHOW", "COMPLETED"])
            .withMessage("Invalid status filter"),
        query("slotTime").optional().isIn([
            "06:00-07:00", "07:00-08:00", "08:00-09:00", "09:00-10:00", "10:00-11:00",
            "11:00-12:00", "12:00-13:00", "13:00-14:00", "14:00-15:00", "15:00-16:00",
            "16:00-17:00", "17:00-18:00", "18:00-19:00", "19:00-20:00", "20:00-21:00",
            "21:00-22:00"
        ]).withMessage("Invalid slot time filter")
    ]),
    async (req, res) => {
        try {
            const SlotBooking = require("../models/SlotBooking");
            const { limit = 20, page = 1, status, slotTime } = req.query;
            
            const filter = { ownerId: req.user.id };
            if (status) filter.bookingStatus = status;
            if (slotTime) filter.slotTime = slotTime;
            
            const bookings = await SlotBooking.find(filter)
                .populate('memberDetails', 'name phoneNo paymentStatus')
                .sort({ bookingDate: -1, slotTime: 1 })
                .limit(parseInt(limit))
                .skip((parseInt(page) - 1) * parseInt(limit));
            
            const total = await SlotBooking.countDocuments(filter);
            
            res.json({
                success: true,
                data: {
                    bookings,
                    pagination: {
                        current: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / parseInt(limit))
                    },
                    filters: { status, slotTime }
                }
            });
        } catch (error) {
            console.error("Debug route error:", error);
            res.status(500).json({
                success: false,
                message: "Error fetching bookings"
            });
        }
    }
);

// Update booking status (for admin purposes)
router.patch("/booking/:bookingId/status",
    auth,
    isOwner,
    checkSubscriptionExpiry,
    isSubscribed,
    checkAdvancedPlan,
    validate([
        param("bookingId").isMongoId().withMessage("Invalid booking ID"),
        body("status").isIn(["CONFIRMED", "CANCELLED", "NO_SHOW", "COMPLETED"])
            .withMessage("Invalid status")
    ]),
    async (req, res) => {
        try {
            const SlotBooking = require("../models/SlotBooking");
            const { bookingId } = req.params;
            const { status } = req.body;
            
            const booking = await SlotBooking.findOne({
                _id: bookingId,
                ownerId: req.user.id
            });
            
            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: "Booking not found"
                });
            }
            
            booking.bookingStatus = status;
            await booking.save();
            
            res.json({
                success: true,
                message: `Booking status updated to ${status}`,
                data: { booking }
            });
            
        } catch (error) {
            console.error("Status update error:", error);
            res.status(500).json({
                success: false,
                message: "Error updating booking status"
            });
        }
    }
);

// ===== HEALTH CHECK FOR SLOT FEATURE =====
router.get("/health",
    (req, res) => {
        res.json({
            success: true,
            message: "Crowd Management & Slot Booking service is running",
            timestamp: new Date().toISOString(),
            version: "1.0.0",
            features: {
                crowdManagement: "Active",
                slotBooking: "Active", 
                whatsappAutomation: "Active",
                analytics: "Active",
                // checkInOut: "Active"
            },
            endpoints: {
                "POST /book": "Book a slot via JWT token",
                "GET /book": "Get slot booking page",
                "GET /crowd-dashboard": "Owner crowd management dashboard",
                "GET /dashboard": "Owner slot dashboard (legacy)",
                "GET /availability/:ownerId/:date": "Check slot availability",
                "POST /manual-book": "Manual booking by owner",
                "PATCH /settings/capacity": "Update slot capacity",
                "GET /statistics": "Slot analytics",
                "POST /send-reminders": "Send WhatsApp reminders",
                "GET /analytics/crowd": "Crowd analytics",
                // "POST /checkin": "Member check-in",
                // "POST /checkout": "Member check-out"
            }
        });
    }
);

module.exports = router;