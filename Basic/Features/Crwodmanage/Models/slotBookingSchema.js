const mongoose = require("mongoose");

const slotBookingSchema = new mongoose.Schema(
    {
        // REFERENCE TO OWNER (FOR ISOLATION)
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Owner',
            required: true,
            index: true
        },
        
        // REFERENCE TO MEMBER
        memberId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Member',
            required: true,
            index: true
        },
        
        // BOOKING DATE (WITHOUT TIME)
        bookingDate: {
            type: Date,
            required: true,
            index: true
        },
        
        // SLOT TIME (e.g., "06:00-07:00", "07:00-08:00")
        slotTime: {
            type: String,
            required: true,
            enum: [
                "06:00-07:00", "07:00-08:00", "08:00-09:00", "09:00-10:00", "10:00-11:00",
                "11:00-12:00", "12:00-13:00", "13:00-14:00", "14:00-15:00", "15:00-16:00",
                "16:00-17:00", "17:00-18:00", "18:00-19:00", "19:00-20:00", "20:00-21:00",
                "21:00-22:00"
            ]
        },
        
        // BOOKING STATUS
        bookingStatus: {
            type: String,
            enum: ["CONFIRMED", "CANCELLED", "NO_SHOW", "COMPLETED"],
            default: "CONFIRMED"
        },
        
        // BOOKING METHOD
        bookingMethod: {
            type: String,
            enum: ["WHATSAPP_LINK", "MANUAL_OWNER", "PREVIOUS_SLOT", "WALK_IN"],
            default: "WHATSAPP_LINK"
        },
        
        // JWT TOKEN USED FOR BOOKING (TO PREVENT DUPLICATE USAGE)
        tokenUsed: {
            type: String,
            index: true,
            sparse: true
        },
        
        // CHECK-IN STATUS
       checkInStatus: {
        checkedIn: { 
            type: Boolean, 
            default: false     // Will remain false until QR feature added
        },
        checkInTime: { 
            type: Date         // Will remain null
        },
        checkOutTime: { 
            type: Date         // Will remain null
        }
    },
        
        // CROWD MANAGEMENT DATA
        crowdData: {
            isFromPreviousSlot: { type: Boolean, default: false },
            previousSlotTime: String,
            warningCount: { type: Number, default: 0 },
            lastWarningDate: Date,
            autoBooked: { type: Boolean, default: false }
        },
        
        // ADDITIONAL METADATA
        metadata: {
            userAgent: String,
            ipAddress: String,
            deviceType: String,
            bookingSource: String // 'whatsapp', 'manual', 'auto'
        }
    },
    { 
        timestamps: true 
    }
);

// COMPOUND INDEXES FOR PERFORMANCE
slotBookingSchema.index({ ownerId: 1, bookingDate: 1 }); // Owner's daily slots
slotBookingSchema.index({ ownerId: 1, bookingDate: 1, slotTime: 1 }); // Specific slot capacity
slotBookingSchema.index({ memberId: 1, bookingDate: 1 }, { unique: true }); // One booking per member per day
slotBookingSchema.index({ tokenUsed: 1 }, { unique: true, sparse: true }); // Prevent token reuse
slotBookingSchema.index({ ownerId: 1, slotTime: 1, bookingDate: 1 }); // Crowd management queries

// VIRTUAL FIELDS
slotBookingSchema.virtual('memberDetails', {
    ref: 'Member',
    localField: 'memberId',
    foreignField: '_id',
    justOne: true
});

slotBookingSchema.virtual('ownerDetails', {
    ref: 'Owner', 
    localField: 'ownerId',
    foreignField: '_id',
    justOne: true
});

// INSTANCE METHODS

// Get slot capacity status with congestion colors
slotBookingSchema.methods.getSlotCapacityStatus = async function() {
    const SlotBooking = this.constructor;
    
    // Get total confirmed bookings for this slot
    const totalBookings = await SlotBooking.countDocuments({
        ownerId: this.ownerId,
        bookingDate: this.bookingDate,
        slotTime: this.slotTime,
        bookingStatus: 'CONFIRMED'
    });
    
    // Get owner's slot capacity settings
    const Owner = mongoose.model('Owner');
    const owner = await Owner.findById(this.ownerId);
    const slotSettings = owner?.slotSettings || {};
    
    // Get capacity for this specific slot or use default
    const maxCapacity = slotSettings.slotSpecificCapacity?.[this.slotTime] || 
                       slotSettings.defaultCapacity || 20;
    
    const percentage = totalBookings > 0 ? (totalBookings / maxCapacity) * 100 : 0;
    
    let status = "SAFE";
    let color = "🟢";
    let message = "Good availability";
    
    if (percentage >= 95) {
        status = "FULL";
        color = "⛔";
        message = "Slot is full";
    } else if (percentage >= 85) {
        status = "CONGESTED";
        color = "🔴";
        message = "Almost full";
    } else if (percentage >= 70) {
        status = "ALMOST_FULL";
        color = "🟡";
        message = "Filling up fast";
    }
    
    return {
        currentBookings: totalBookings,
        maxCapacity,
        percentage: Math.round(percentage),
        status,
        color,
        message,
        availableSpots: Math.max(0, maxCapacity - totalBookings),
        isAvailable: totalBookings < maxCapacity
    };
};

// Check if member can still modify booking
slotBookingSchema.methods.canModifyBooking = function() {
    const slotDateTime = new Date(this.bookingDate);
    const [startTime] = this.slotTime.split('-');
    const [hours, minutes] = startTime.split(':');
    slotDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    const now = new Date();
    const timeDiff = slotDateTime.getTime() - now.getTime();
    const minutesDiff = timeDiff / (1000 * 60);
    
    return minutesDiff > 30; // Can modify until 30 minutes before slot
};

// STATIC METHODS

// Get owner's complete daily crowd management data
slotBookingSchema.statics.getOwnerCrowdDashboard = async function(ownerId, date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Get all slots with member details
    const slotData = await this.aggregate([
        {
            $match: {
                ownerId: new mongoose.Types.ObjectId(ownerId),
                bookingDate: { $gte: startOfDay, $lte: endOfDay },
                bookingStatus: 'CONFIRMED'
            }
        },
        {
            $lookup: {
                from: 'members',
                localField: 'memberId',
                foreignField: '_id',
                as: 'member'
            }
        },
        {
            $unwind: '$member'
        },
        {
            $group: {
                _id: '$slotTime',
                count: { $sum: 1 },
                members: {
                    $push: {
                        name: '$member.name',
                        phoneNo: '$member.phoneNo',
                        memberId: '$member._id',
                        bookingMethod: '$bookingMethod',
                        checkInStatus: '$checkInStatus',
                        isFromPrevious: '$crowdData.isFromPreviousSlot'
                    }
                },
                methodBreakdown: {
                    $push: '$bookingMethod'
                }
            }
        },
        {
            $sort: { _id: 1 }
        }
    ]);
    
    return slotData;
};

// Get member's booking history and patterns
slotBookingSchema.statics.getMemberBookingPattern = async function(memberId, ownerId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const bookings = await this.find({
        memberId,
        ownerId,
        bookingDate: { $gte: startDate },
        bookingStatus: { $in: ['CONFIRMED', 'COMPLETED'] }
    }).sort({ bookingDate: 1 });
    
    // Analyze patterns
    const slotFrequency = {};
    let totalBookings = bookings.length;
    let warningCount = 0;
    
    bookings.forEach(booking => {
        if (!slotFrequency[booking.slotTime]) {
            slotFrequency[booking.slotTime] = 0;
        }
        slotFrequency[booking.slotTime]++;
        warningCount += booking.crowdData.warningCount || 0;
    });
    
    // Find most preferred slot
    const preferredSlot = Object.keys(slotFrequency).reduce((a, b) => 
        slotFrequency[a] > slotFrequency[b] ? a : b, null
    );
    
    return {
        totalBookings,
        preferredSlot,
        slotFrequency,
        warningCount,
        bookingFrequency: totalBookings / days, // bookings per day
        lastBooking: bookings[bookings.length - 1]
    };
};

// Get member's last booked slot (for auto-assignment)
slotBookingSchema.statics.getMemberLastSlot = async function(memberId, ownerId) {
    const lastBooking = await this.findOne({
        memberId,
        ownerId,
        bookingDate: { $lt: new Date() },
        bookingStatus: { $in: ['CONFIRMED', 'COMPLETED'] }
    }).sort({ bookingDate: -1 });
    
    return lastBooking?.slotTime || null;
};

// Check if member has ever booked a slot
slotBookingSchema.statics.hasEverBooked = async function(memberId, ownerId) {
    const count = await this.countDocuments({
        memberId,
        ownerId,
        bookingStatus: { $in: ['CONFIRMED', 'COMPLETED', 'CANCELLED'] }
    });
    
    return count > 0;
};

// Get slot availability for specific date with crowd analysis
slotBookingSchema.statics.getSlotAvailabilityWithCrowd = async function(ownerId, date) {
    const Owner = mongoose.model('Owner');
    const owner = await Owner.findById(ownerId);
    const slotSettings = owner?.slotSettings || {};
    
    const allSlots = [
        "06:00-07:00", "07:00-08:00", "08:00-09:00", "09:00-10:00", "10:00-11:00",
        "11:00-12:00", "12:00-13:00", "13:00-14:00", "14:00-15:00", "15:00-16:00", 
        "16:00-17:00", "17:00-18:00", "18:00-19:00", "19:00-20:00", "20:00-21:00",
        "21:00-22:00"
    ];
    
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Get current bookings for each slot
    const currentBookings = await this.aggregate([
        {
            $match: {
                ownerId: new mongoose.Types.ObjectId(ownerId),
                bookingDate: { $gte: startOfDay, $lte: endOfDay },
                bookingStatus: 'CONFIRMED'
            }
        },
        {
            $group: {
                _id: '$slotTime',
                count: { $sum: 1 }
            }
        }
    ]);
    
    // Build availability data with crowd status
    const availability = allSlots.map(slotTime => {
        const slotData = currentBookings.find(slot => slot._id === slotTime);
        const currentCount = slotData ? slotData.count : 0;
        
        // Get capacity for this slot
        const maxCapacity = slotSettings.slotSpecificCapacity?.[slotTime] || 
                           slotSettings.defaultCapacity || 20;
        
        const percentage = currentCount > 0 ? (currentCount / maxCapacity) * 100 : 0;
        
        let status = "SAFE";
        let color = "🟢";
        let message = "Good availability";
        
        if (percentage >= 95) {
            status = "FULL";
            color = "⛔";
            message = "Slot is full";
        } else if (percentage >= 85) {
            status = "CONGESTED";
            color = "🔴";
            message = "Almost full";
        } else if (percentage >= 70) {
            status = "ALMOST_FULL";
            color = "🟡";
            message = "Filling up fast";
        }
        
        return {
            slotTime,
            currentBookings: currentCount,
            maxCapacity,
            availableSpots: Math.max(0, maxCapacity - currentCount),
            percentage: Math.round(percentage),
            status,
            color,
            message,
            isAvailable: currentCount < maxCapacity,
            isRecommended: percentage <= 60 // Recommend slots under 60%
        };
    });
    
    return availability;
};

// PRE-SAVE MIDDLEWARE
slotBookingSchema.pre('save', function(next) {
    // Ensure booking date is start of day
    if (this.bookingDate) {
        this.bookingDate.setHours(0, 0, 0, 0);
    }
    next();
});

// ENSURE VIRTUAL FIELDS ARE SERIALIZED
slotBookingSchema.set('toJSON', { virtuals: true });
slotBookingSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model("SlotBooking", slotBookingSchema);