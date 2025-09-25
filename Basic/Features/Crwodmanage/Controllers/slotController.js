const SlotBooking = require("../Models/slotBookingSchema")
const Member = require("../../MemberCrud/Models/Member");
const Owner = require("../../MemberCrud/Models/Owner");
const jwt = require("jsonwebtoken");
const { sendWhatsapp } = require("../../../../Utils/sendWhatsapp");

// ===== HELPER FUNCTIONS =====

// Generate JWT token for member slot booking
const generateSlotBookingToken = (memberId, ownerId, memberName, date) => {
    const payload = {
        memberId,
        ownerId,
        memberName,
        date: date.toISOString().split('T')[0],
        type: 'slot_booking',
        generatedAt: new Date().toISOString()
    };
    
    // Token expires in 24 hours
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
};

// Get slot availability data with crowd status
const getSlotAvailabilityData = async (ownerId, date) => {
    try {
        return await SlotBooking.getSlotAvailabilityWithCrowd(ownerId, date);
    } catch (error) {
        console.error("Error getting slot availability:", error);
        return [];
    }
};

// Send WhatsApp slot booking reminder to member
const sendSlotBookingReminder = async (member, ownerId, targetDate) => {
    try {
        const owner = await Owner.findById(ownerId);
        if (!owner) throw new Error("Owner not found");
        
        // Generate unique token for this member and date
        const token = generateSlotBookingToken(
            member._id, 
            ownerId, 
            member.name, 
            targetDate
        );
        
        // Check if member has ever booked
        const hasEverBooked = await SlotBooking.hasEverBooked(member._id, ownerId);
        
        let message;
        
        if (!hasEverBooked) {
            // Warning message for members who never booked
            message = `🚨 *SLOT BOOKING REQUIRED* 🚨\n\n` +
                     `Hi ${member.name}! 👋\n\n` +
                     `⚠️ You haven't selected your workout slot yet!\n` +
                     `To avoid crowding, please book your preferred time:\n\n` +
                     `📅 Date: ${targetDate.toLocaleDateString()}\n` +
                     `🏃‍♂️ Gym: ${owner.firstName} ${owner.lastName}\n\n` +
                     `👆 *CLICK TO BOOK YOUR SLOT:*\n` +
                     `${process.env.FRONTEND_URL}/book-slot?token=${token}\n\n` +
                     `⏰ Available slots:\n` +
                     `• Morning: 6AM-12PM\n` +
                     `• Evening: 4PM-10PM\n\n` +
                     `🟢 Green = Safe | 🟡 Yellow = Filling | 🔴 Red = Almost Full\n\n` +
                     `*Please select your time ASAP!*`;
        } else {
            // Check member's previous slot
            const previousSlot = await SlotBooking.getMemberLastSlot(member._id, ownerId);
            
            if (previousSlot) {
                message = `🏋️‍♂️ *DAILY SLOT BOOKING* 📅\n\n` +
                         `Hi ${member.name}! 👋\n\n` +
                         `Time to book your workout slot for tomorrow:\n\n` +
                         `📅 Date: ${targetDate.toLocaleDateString()}\n` +
                         `🏃‍♂️ Gym: ${owner.firstName} ${owner.lastName}\n` +
                         `⭐ Your usual time: ${previousSlot}\n\n` +
                         `👆 *CLICK TO BOOK:*\n` +
                         `${process.env.FRONTEND_URL}/book-slot?token=${token}\n\n` +
                         `💡 *If you don't book by midnight, we'll auto-assign your usual slot (${previousSlot})*\n\n` +
                         `⏰ All available slots:\n` +
                         `• Morning: 6AM-12PM\n` +
                         `• Evening: 4PM-10PM\n\n` +
                         `🟢 Green = Safe | 🟡 Yellow = Filling | 🔴 Red = Almost Full\n\n` +
                         `Stay fit! 💪`;
            } else {
                message = `🏋️‍♂️ *DAILY SLOT BOOKING* 📅\n\n` +
                         `Hi ${member.name}! 👋\n\n` +
                         `Time to book your workout slot for tomorrow:\n\n` +
                         `📅 Date: ${targetDate.toLocaleDateString()}\n` +
                         `🏃‍♂️ Gym: ${owner.firstName} ${owner.lastName}\n\n` +
                         `👆 *CLICK TO BOOK:*\n` +
                         `${process.env.FRONTEND_URL}/book-slot?token=${token}\n\n` +
                         `⏰ Available slots:\n` +
                         `• Morning: 6AM-12PM\n` +
                         `• Evening: 4PM-10PM\n\n` +
                         `🟢 Green = Safe | 🟡 Yellow = Filling | 🔴 Red = Almost Full\n\n` +
                         `Please select your preferred time! 💪`;
            }
        }
        
        // Send WhatsApp message
        const result = await sendWhatsapp(member.phoneNo, message);
        
        console.log(`✅ Slot reminder sent to ${member.name}: ${result.sid}`);
        return { success: true, sid: result.sid };
        
    } catch (error) {
        console.error(`❌ Failed to send slot reminder to ${member.name}:`, error);
        throw error;
    }
};

// Generate crowd recommendations
const generateCrowdRecommendations = (slots, stats) => {
    const recommendations = [];
    
    // Check for overcrowded slots
    const busySlots = slots.filter(slot => slot.percentage >= 85);
    if (busySlots.length > 0) {
        recommendations.push({
            type: 'warning',
            title: 'Overcrowded Slots Detected',
            message: `${busySlots.length} slots are running at 85%+ capacity`,
            action: 'Consider increasing capacity or encouraging members to book alternative times',
            slots: busySlots.map(s => s.slotTime)
        });
    }
    
    // Check for underutilized slots
    const emptySlo = slots.filter(slot => slot.percentage <= 30);
    if (emptySlots.length > 3) {
        recommendations.push({
            type: 'info',
            title: 'Underutilized Time Slots',
            message: `${emptySlots.length} slots have low utilization (under 30%)`,
            action: 'Consider promoting these slots or adjusting capacity',
            slots: emptySlots.map(s => s.slotTime)
        });
    }
    
    // Peak time analysis
    const peakSlots = slots.filter(slot => slot.percentage >= 70);
    if (peakSlots.length > 0) {
        const peakTimes = peakSlots.map(s => s.slotTime);
        recommendations.push({
            type: 'success',
            title: 'Peak Hours Identified',
            message: `Popular time slots: ${peakTimes.slice(0, 3).join(', ')}`,
            action: 'These are your gym\'s busiest times',
            slots: peakTimes
        });
    }
    
    return recommendations;
};

// ===== MEMBER SLOT BOOKING FUNCTIONS =====

// Get slot booking page (accessed via WhatsApp link)
exports.getSlotBookingPage = async (req, res) => {
    try {
        console.log("📱 Serving slot booking page...");
        
        const { memberDetails, ownerDetails, tokenData } = req;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Get current booking for today (if any)
        const existingBooking = await SlotBooking.findOne({
            memberId: memberDetails._id,
            ownerId: ownerDetails._id,
            bookingDate: today
        });
        
        // Get all slot availability for today
        const slotAvailability = await getSlotAvailabilityData(ownerDetails._id, today);
        
        // Get member's booking pattern and previous slot
        const bookingPattern = await SlotBooking.getMemberBookingPattern(
            memberDetails._id, 
            ownerDetails._id,
            30 // Last 30 days
        );
        
        // Check if member has ever booked
        const hasEverBooked = await SlotBooking.hasEverBooked(memberDetails._id, ownerDetails._id);
        
        res.json({
            success: true,
            data: {
                member: {
                    name: memberDetails.name,
                    phoneNo: memberDetails.phoneNo,
                    memberId: memberDetails._id,
                    paymentStatus: memberDetails.paymentStatus
                },
                gym: {
                    name: `${ownerDetails.firstName} ${ownerDetails.lastName}`,
                    plan: ownerDetails.subscriptionPlan
                },
                booking: {
                    date: today.toISOString().split('T')[0],
                    currentBooking: existingBooking,
                    hasEverBooked,
                    pattern: bookingPattern
                },
                slots: slotAvailability,
                token: req.validToken,
                ui: {
                    title: hasEverBooked ? "Select Your Workout Slot" : "⚠️ First Time Slot Selection Required",
                    subtitle: hasEverBooked 
                        ? `Choose your preferred time for ${today.toLocaleDateString()}`
                        : "Please select your preferred workout time to avoid crowding",
                    instructions: [
                        "🟢 Green slots have good availability", 
                        "🟡 Yellow slots are filling up fast",
                        "🔴 Red slots are almost full",
                        existingBooking 
                            ? "You can change your booking until 30 minutes before the slot"
                            : hasEverBooked
                                ? `Your usual slot: ${bookingPattern.preferredSlot || 'None'}`
                                : "⚠️ This is your first booking - please choose carefully"
                    ].filter(Boolean)
                }
            }
        });
        
    } catch (error) {
        console.error("❌ Error serving booking page:", error);
        res.status(500).json({
            success: false,
            message: "Error loading booking page"
        });
    }
};

// Book a slot

exports.bookSlot = async (req, res) => {
    try {
        console.log("🎯 Processing slot booking...");
        
        const { slotTime } = req.body;
        const { memberDetails, ownerDetails, validToken } = req;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // GET CURRENT SLOT STATUS (Don't block, just check)
        const slotStatus = await getSlotStatusWithWarnings(ownerDetails._id, today, slotTime);
        
        // Check if member already has booking today
        const existingBooking = await SlotBooking.findOne({
            memberId: memberDetails._id,
            ownerId: ownerDetails._id,
            bookingDate: today
        });
        
        if (existingBooking) {
            // UPDATE existing booking
            const oldSlot = existingBooking.slotTime;
            existingBooking.slotTime = slotTime;
            existingBooking.tokenUsed = validToken;
            existingBooking.bookingMethod = 'WHATSAPP_LINK';
            existingBooking.metadata = {
                ...existingBooking.metadata,
                userAgent: req.headers['user-agent'],
                deviceType: req.headers['user-agent']?.includes('Mobile') ? 'Mobile' : 'Desktop',
                bookingSource: 'whatsapp',
                updatedAt: new Date(),
                overcrowdWarning: slotStatus.isOvercrowded  // Track if this was an overflow booking
            };
            
            await existingBooking.save();
            
            console.log(`✅ Updated booking: ${memberDetails.name} ${oldSlot} → ${slotTime}`);
            
            return res.json({
                success: true,
                message: generateBookingMessage(slotTime, slotStatus, true),
                data: {
                    booking: existingBooking,
                    slotTime,
                    isUpdate: true,
                    slotStatus,  // Include crowd info
                    canModify: existingBooking.canModifyBooking(),
                    warning: slotStatus.warning || null
                }
            });
        } else {
            // CREATE new booking (ALWAYS ALLOW - Never block)
            const newBooking = await SlotBooking.create({
                ownerId: ownerDetails._id,
                memberId: memberDetails._id,
                bookingDate: today,
                slotTime,
                tokenUsed: validToken,
                bookingMethod: 'WHATSAPP_LINK',
                crowdData: {
                    isFromPreviousSlot: false,
                    warningCount: 0,
                    autoBooked: false
                },
                metadata: {
                    userAgent: req.headers['user-agent'],
                    ipAddress: req.ip,
                    deviceType: req.headers['user-agent']?.includes('Mobile') ? 'Mobile' : 'Desktop',
                    bookingSource: 'whatsapp',
                    overcrowdWarning: slotStatus.isOvercrowded  // Mark overflow bookings
                }
            });
            
            console.log(`✅ New booking: ${memberDetails.name} → ${slotTime} (${slotStatus.currentBookings}/${slotStatus.maxCapacity})`);
            
            return res.status(201).json({
                success: true,
                message: generateBookingMessage(slotTime, slotStatus, false),
                data: {
                    booking: newBooking,
                    slotTime,
                    isUpdate: false,
                    slotStatus,  // Include crowd info
                    canModify: newBooking.canModifyBooking(),
                    warning: slotStatus.warning || null
                }
            });
        }
        
    } catch (error) {
        console.error("❌ Error booking slot:", error);
        res.status(500).json({
            success: false,
            message: "Error processing slot booking"
        });
    }
};

// ===== HELPER FUNCTION - GET SLOT STATUS WITH WARNINGS =====

const getSlotStatusWithWarnings = async (ownerId, date, slotTime) => {
    try {
        // Get current bookings count
        const currentBookings = await SlotBooking.countDocuments({
            ownerId,
            bookingDate: date,
            slotTime,
            bookingStatus: { $in: ['CONFIRMED', 'COMPLETED'] }
        });
        
        // Get owner's capacity settings
        const owner = await Owner.findById(ownerId);
        const slotSettings = owner?.slotSettings || {};
        const maxCapacity = slotSettings.slotSpecificCapacity?.[slotTime] || 
                           slotSettings.defaultCapacity || 20;
        
        // Calculate status AFTER this booking
        const afterBookingCount = currentBookings + 1;
        const percentage = (afterBookingCount / maxCapacity) * 100;
        
        let status = "SAFE";
        let color = "🟢";
        let warning = null;
        let isOvercrowded = false;
        
        if (percentage > 100) {
            // OVERFLOW - Beyond capacity
            status = "OVERFLOW";
            color = "🚨";
            isOvercrowded = true;
            const overflowCount = afterBookingCount - maxCapacity;
            warning = {
                type: "OVERFLOW",
                message: `⚠️ OVERCROWDED: This slot will have ${afterBookingCount} people (${overflowCount} over the ${maxCapacity} limit)`,
                suggestion: "Consider selecting a different time for a better experience",
                severity: "HIGH"
            };
        } else if (percentage >= 95) {
            // NEARLY FULL
            status = "NEARLY_FULL";
            color = "🔴";
            warning = {
                type: "NEARLY_FULL", 
                message: `⚠️ PACKED: This slot will be very crowded (${afterBookingCount}/${maxCapacity})`,
                suggestion: "Gym will be quite busy. Consider an earlier or later slot",
                severity: "MEDIUM"
            };
        } else if (percentage >= 85) {
            // BUSY
            status = "BUSY";
            color = "🟡";
            warning = {
                type: "BUSY",
                message: `ℹ️ BUSY: This slot will be quite full (${afterBookingCount}/${maxCapacity})`,
                suggestion: "Gym will be moderately busy",
                severity: "LOW"
            };
        }
        
        return {
            currentBookings: afterBookingCount,
            maxCapacity,
            percentage: Math.round(percentage),
            status,
            color,
            warning,
            isOvercrowded,
            availableSpots: Math.max(0, maxCapacity - afterBookingCount)
        };
        
    } catch (error) {
        console.error("Error getting slot status:", error);
        return {
            currentBookings: 0,
            maxCapacity: 20,
            percentage: 0,
            status: "SAFE",
            color: "🟢",
            warning: null,
            isOvercrowded: false
        };
    }
};

// ===== HELPER FUNCTION - GENERATE BOOKING MESSAGES =====

const generateBookingMessage = (slotTime, slotStatus, isUpdate) => {
    const baseMessage = isUpdate 
        ? `Your slot has been updated to ${slotTime}! 💪`
        : `Your slot ${slotTime} has been booked successfully! 🎉`;
    
    if (slotStatus.warning) {
        switch (slotStatus.warning.type) {
            case "OVERFLOW":
                return `${baseMessage}\n\n🚨 ${slotStatus.warning.message}\n💡 ${slotStatus.warning.suggestion}`;
            case "NEARLY_FULL":
                return `${baseMessage}\n\n🔴 ${slotStatus.warning.message}\n💡 ${slotStatus.warning.suggestion}`;
            case "BUSY":
                return `${baseMessage}\n\n🟡 ${slotStatus.warning.message}`;
            default:
                return baseMessage;
        }
    }
    
    return baseMessage;
};
// ===== MEMBER FUNCTIONS CONTINUED =====

// Get slot availability for a specific date
exports.getSlotAvailability = async (req, res) => {
    try {
        console.log("📊 Fetching slot availability...");
        
        const { ownerId, date } = req.params;
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);
        
        // Verify owner has advanced plan
        const owner = await Owner.findById(ownerId);
        if (!owner || !["ADVANCED", "ENTERPRISE"].includes(owner.subscriptionPlan)) {
            return res.status(403).json({
                success: false,
                message: "Slot booking feature is not available for this gym",
                errorCode: "FEATURE_NOT_AVAILABLE"
            });
        }
        
        const slotAvailability = await getSlotAvailabilityData(ownerId, targetDate);
        
        res.json({
            success: true,
            data: {
                date: targetDate.toISOString().split('T')[0],
                gym: {
                    name: `${owner.firstName} ${owner.lastName}`,
                    plan: owner.subscriptionPlan
                },
                slots: slotAvailability,
                metadata: {
                    totalSlots: slotAvailability.length,
                    availableSlots: slotAvailability.filter(slot => slot.isAvailable).length,
                    safeSlots: slotAvailability.filter(slot => slot.status === 'SAFE').length,
                    busySlots: slotAvailability.filter(slot => slot.status !== 'SAFE').length
                }
            }
        });
        
    } catch (error) {
        console.error("❌ Error fetching availability:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching slot availability"
        });
    }
};

// Cancel slot booking
exports.cancelSlotBooking = async (req, res) => {
    try {
        console.log("❌ Cancelling slot booking...");
        
        const { bookingId } = req.params;
        const { memberDetails } = req;
        
        const booking = await SlotBooking.findOne({
            _id: bookingId,
            memberId: memberDetails._id
        });
        
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
                errorCode: "BOOKING_NOT_FOUND"
            });
        }
        
        // Check if cancellation is allowed (at least 30 minutes before slot)
        if (!booking.canModifyBooking()) {
            return res.status(400).json({
                success: false,
                message: "Cannot cancel booking less than 30 minutes before the slot",
                errorCode: "CANCELLATION_TOO_LATE",
                slotTime: booking.slotTime
            });
        }
        
        booking.bookingStatus = 'CANCELLED';
        await booking.save();
        
        res.json({
            success: true,
            message: `Booking for ${booking.slotTime} cancelled successfully`,
            data: { 
                booking,
                refundEligible: true // Could implement refund logic here
            }
        });
        
    } catch (error) {
        console.error("❌ Error cancelling booking:", error);
        res.status(500).json({
            success: false,
            message: "Error cancelling booking"
        });
    }
};

// Get member's slot booking history
exports.getMemberSlotHistory = async (req, res) => {
    try {
        console.log("📚 Fetching member slot history...");
        
        const { memberId } = req.params;
        const { limit = 10, page = 1 } = req.query;
        
        const bookings = await SlotBooking.find({
            memberId,
            bookingStatus: { $in: ['CONFIRMED', 'CANCELLED', 'COMPLETED'] }
        })
        .sort({ bookingDate: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit));
        
        const total = await SlotBooking.countDocuments({
            memberId,
            bookingStatus: { $in: ['CONFIRMED', 'CANCELLED', 'COMPLETED'] }
        });
        
        // Get booking pattern
        const pattern = await SlotBooking.getMemberBookingPattern(memberId, bookings[0]?.ownerId, 30);
        
        res.json({
            success: true,
            data: {
                bookings,
                pattern,
                pagination: {
                    current: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            }
        });
        
    } catch (error) {
        console.error("❌ Error fetching history:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching booking history"
        });
    }
 };

// // ===== MEMBER CHECK-IN/OUT FUNCTIONS =====

// // Member check-in to slot
// exports.memberCheckIn = async (req, res) => {
//     try {
//         console.log("✅ Processing member check-in...");
        
//         const { bookingId } = req.body;
//         const { memberDetails, ownerDetails } = req;
        
//         const today = new Date();
//         today.setHours(0, 0, 0, 0);
        
//         // Find booking for today
//         let booking;
//         if (bookingId) {
//             booking = await SlotBooking.findOne({
//                 _id: bookingId,
//                 memberId: memberDetails._id
//             });
//         } else {
//             booking = await SlotBooking.findOne({
//                 memberId: memberDetails._id,
//                 ownerId: ownerDetails._id,
//                 bookingDate: today,
//                 bookingStatus: 'CONFIRMED'
//             });
//         }
        
//         if (!booking) {
//             return res.status(404).json({
//                 success: false,
//                 message: "No confirmed booking found for today",
//                 errorCode: "NO_BOOKING_FOUND"
//             });
//         }
        
//         // Check if already checked in
//         if (booking.checkInStatus.checkedIn) {
//             return res.status(400).json({
//                 success: false,
//                 message: `Already checked in at ${booking.checkInStatus.checkInTime.toLocaleTimeString()}`,
//                 errorCode: "ALREADY_CHECKED_IN",
//                 checkInTime: booking.checkInStatus.checkInTime
//             });
//         }
        
//         // Update check-in status
//         booking.checkInStatus.checkedIn = true;
//         booking.checkInStatus.checkInTime = new Date();
//         await booking.save();
        
//         res.json({
//             success: true,
//             message: `Welcome ${memberDetails.name}! Checked in to ${booking.slotTime} slot`,
//             data: {
//                 booking,
//                 checkInTime: booking.checkInStatus.checkInTime,
//                 slotTime: booking.slotTime
//             }
//         });
        
//     } catch (error) {
//         console.error("❌ Error with member check-in:", error);
//         res.status(500).json({
//             success: false,
//             message: "Error processing check-in"
//         });
//     }
// };

// // Member check-out from slot
// exports.memberCheckOut = async (req, res) => {
//     try {
//         console.log("👋 Processing member check-out...");
        
//         const { bookingId } = req.body;
//         const { memberDetails, ownerDetails } = req;
        
//         const today = new Date();
//         today.setHours(0, 0, 0, 0);
        
//         // Find booking for today
//         let booking;
//         if (bookingId) {
//             booking = await SlotBooking.findOne({
//                 _id: bookingId,
//                 memberId: memberDetails._id
//             });
//         } else {
//             booking = await SlotBooking.findOne({
//                 memberId: memberDetails._id,
//                 ownerId: ownerDetails._id,
//                 bookingDate: today,
//                 bookingStatus: 'CONFIRMED',
//                 'checkInStatus.checkedIn': true
//             });
//         }
        
//         if (!booking) {
//             return res.status(404).json({
//                 success: false,
//                 message: "No active check-in found for today",
//                 errorCode: "NO_ACTIVE_CHECKIN"
//             });
//         }
        
//         // Check if already checked out
//         if (booking.checkInStatus.checkOutTime) {
//             return res.status(400).json({
//                 success: false,
//                 message: `Already checked out at ${booking.checkInStatus.checkOutTime.toLocaleTimeString()}`,
//                 errorCode: "ALREADY_CHECKED_OUT",
//                 checkOutTime: booking.checkInStatus.checkOutTime
//             });
//         }
        
//         // Update check-out status
//         booking.checkInStatus.checkOutTime = new Date();
//         booking.bookingStatus = 'COMPLETED';
//         await booking.save();
        
//         // Calculate workout duration
//         const duration = Math.round((booking.checkInStatus.checkOutTime - booking.checkInStatus.checkInTime) / (1000 * 60));
        
//         res.json({
//             success: true,
//             message: `Thanks ${memberDetails.name}! Workout completed in ${duration} minutes`,
//             data: {
//                 booking,
//                 checkOutTime: booking.checkInStatus.checkOutTime,
//                 duration: `${duration} minutes`,
//                 slotTime: booking.slotTime
//             }
//         });
        
//     } catch (error) {
//         console.error("❌ Error with member check-out:", error);
//         res.status(500).json({
//             success: false,
//             message: "Error processing check-out"
//         });
//     }
// };

// // Get slot attendance for specific date
// exports.getSlotAttendance = async (req, res) => {
//     try {
//         console.log("📊 Fetching slot attendance...");
        
//         const { date } = req.params;
//         const ownerId = req.user.id;
        
//         const targetDate = new Date(date);
//         targetDate.setHours(0, 0, 0, 0);
        
//         const endOfDay = new Date(targetDate);
//         endOfDay.setHours(23, 59, 59, 999);
        
//         // Get attendance data
//         const attendanceData = await SlotBooking.aggregate([
//             {
//                 $match: {
//                     ownerId: new mongoose.Types.ObjectId(ownerId),
//                     bookingDate: { $gte: targetDate, $lte: endOfDay }
//                 }
//             },
//             {
//                 $lookup: {
//                     from: 'members',
//                     localField: 'memberId',
//                     foreignField: '_id',
//                     as: 'member'
//                 }
//             },
//             {
//                 $unwind: '$member'
//             },
//             {
//                 $group: {
//                     _id: '$slotTime',
//                     totalBookings: { $sum: 1 },
//                     checkedIn: {
//                         $sum: {
//                             $cond: ['$checkInStatus.checkedIn', 1, 0]
//                         }
//                     },
//                     completed: {
//                         $sum: {
//                             $cond: [{ $eq: ['$bookingStatus', 'COMPLETED'] }, 1, 0]
//                         }
//                     },
//                     noShows: {
//                         $sum: {
//                             $cond: [{ $eq: ['$bookingStatus', 'NO_SHOW'] }, 1, 0]
//                         }
//                     },
//                     members: {
//                         $push: {
//                             name: '$member.name',
//                             phoneNo: '$member.phoneNo',
//                             checkedIn: '$checkInStatus.checkedIn',
//                             checkInTime: '$checkInStatus.checkInTime',
//                             checkOutTime: '$checkInStatus.checkOutTime',
//                             status: '$bookingStatus'
//                         }
//                     }
//                 }
//             },
//             {
//                 $sort: { _id: 1 }
//             }
//         ]);
        
//         // Calculate overall stats
//         const overallStats = attendanceData.reduce((acc, slot) => {
//             acc.totalBookings += slot.totalBookings;
//             acc.totalCheckedIn += slot.checkedIn;
//             acc.totalCompleted += slot.completed;
//             acc.totalNoShows += slot.noShows;
//             return acc;
//         }, { totalBookings: 0, totalCheckedIn: 0, totalCompleted: 0, totalNoShows: 0 });
        
//         const checkInRate = overallStats.totalBookings > 0 
//             ? Math.round((overallStats.totalCheckedIn / overallStats.totalBookings) * 100)
//             : 0;
        
//         const completionRate = overallStats.totalBookings > 0 
//             ? Math.round((overallStats.totalCompleted / overallStats.totalBookings) * 100)
//             : 0;
        
//         res.json({
//             success: true,
//             data: {
//                 date: targetDate.toISOString().split('T')[0],
//                 slots: attendanceData,
//                 overallStats: {
//                     ...overallStats,
//                     checkInRate,
//                     completionRate,
//                     noShowRate: overallStats.totalBookings > 0 
//                         ? Math.round((overallStats.totalNoShows / overallStats.totalBookings) * 100)
//                         : 0
//                 }
//             }
//         });
        
//     } catch (error) {
//         console.error("❌ Error fetching attendance:", error);
//         res.status(500).json({
//             success: false,
//             message: "Error fetching slot attendance"
//         });
//     }
// };
// ===== OWNER CROWD MANAGEMENT FUNCTIONS =====

// Get crowd management dashboard (main dashboard for owners)
exports.getCrowdManagementDashboard = async (req, res) => {
    try {
        console.log("🏢 Loading crowd management dashboard...");
        
        const ownerId = req.user.id;
        const { date } = req.query;
        
        const targetDate = date ? new Date(date) : new Date();
        targetDate.setHours(0, 0, 0, 0);
        
        // Get complete crowd dashboard data
        const crowdData = await SlotBooking.getOwnerCrowdDashboard(ownerId, targetDate);
        
        // Get slot capacity settings
        const owner = await Owner.findById(ownerId);
        const slotSettings = owner?.slotSettings || {};
        const defaultCapacity = slotSettings.defaultCapacity || 20;
        
        // All available slot times
        const allSlotTimes = [
            "06:00-07:00", "07:00-08:00", "08:00-09:00", "09:00-10:00", "10:00-11:00",
            "11:00-12:00", "12:00-13:00", "13:00-14:00", "14:00-15:00", "15:00-16:00",
            "16:00-17:00", "17:00-18:00", "18:00-19:00", "19:00-20:00", "20:00-21:00",
            "21:00-22:00"
        ];
        
        // Build comprehensive dashboard
   const dashboardSlots = allSlotTimes.map(slotTime => {
            const slotData = crowdData.find(slot => slot._id === slotTime);
            const currentBookings = slotData ? slotData.count : 0;
            
            // Get capacity for this specific slot or use default
            const maxCapacity = slotSettings.slotSpecificCapacity?.[slotTime] || defaultCapacity;
            const percentage = currentBookings > 0 ? (currentBookings / maxCapacity) * 100 : 0;
            
            let status = "SAFE";
            let color = "🟢";
            let message = "Good availability";
            
            // Enhanced status logic with overflow support
            if (percentage > 100) {
                // OVERFLOW CONDITION - Beyond capacity but allowed
                status = "OVERFLOW";
                color = "🚨";
                const overflowCount = currentBookings - maxCapacity;
                message = `OVERCROWDED! ${overflowCount} over limit`;
            } else if (percentage >= 95) {
                status = "NEARLY_FULL";
                color = "🔴";
                message = "Nearly full";
            } else if (percentage >= 85) {
                status = "BUSY";
                color = "🟡";
                message = "Getting busy";
            } else if (percentage >= 70) {
                status = "MODERATE";
                color = "🟡";
                message = "Moderately busy";
            } else {
                status = "SAFE";
                color = "🟢";
                message = "Good availability";
            }
            
            // Analyze booking methods breakdown
            const methodBreakdown = slotData?.methodBreakdown || [];
            const methodStats = {
                whatsapp: methodBreakdown.filter(m => m === 'WHATSAPP_LINK').length,
                manual: methodBreakdown.filter(m => m === 'MANUAL_OWNER').length,
                previous: methodBreakdown.filter(m => m === 'PREVIOUS_SLOT').length,
                walkIn: methodBreakdown.filter(m => m === 'WALK_IN').length
            };
            
            return {
                slotTime,
                currentBookings,
                maxCapacity,
                availableSpots: Math.max(0, maxCapacity - currentBookings),
                overflowCount: Math.max(0, currentBookings - maxCapacity),  // NEW: Show overflow count
                percentage: Math.round(percentage),
                status,
                color,
                message,
                members: slotData ? slotData.members : [],
                methodStats,
                isOverflow: currentBookings > maxCapacity,  // NEW: Flag for overflow slots
                isRecommended: percentage <= 60,  // Recommend slots under 60%
                
                // NEW: Overflow details for business intelligence
                overflowDetails: currentBookings > maxCapacity ? {
                    overflowMembers: currentBookings - maxCapacity,
                    overflowPercentage: Math.round(((currentBookings - maxCapacity) / maxCapacity) * 100),
                    businessImpact: "High demand slot - consider capacity expansion",
                    revenueOpportunity: currentBookings > maxCapacity
                } : null,
                
                // NEW: Crowd level warnings
                crowdLevel: percentage > 100 ? "OVERCROWDED" :
                           percentage >= 95 ? "PACKED" :
                           percentage >= 85 ? "BUSY" :
                           percentage >= 70 ? "MODERATE" : "COMFORTABLE"
            };
        });
        
        // Calculate overall statistics
        const overallStats = {
            totalBookings: crowdData.reduce((sum, slot) => sum + slot.count, 0),
            totalCapacity: defaultCapacity * allSlotTimes.length,
            averageOccupancy: crowdData.length > 0 
                ? Math.round(crowdData.reduce((sum, slot) => sum + slot.count, 0) / allSlotTimes.length)
                : 0,
            busySlots: dashboardSlots.filter(slot => slot.percentage >= 70).length,
            safeSlots: dashboardSlots.filter(slot => slot.percentage < 70).length,
            fullSlots: dashboardSlots.filter(slot => slot.percentage >= 95).length
        };
        
        // Get check-in statistics
        const checkInStats = await SlotBooking.aggregate([
            {
                $match: {
                    ownerId: owner._id,
                    bookingDate: targetDate,
                    bookingStatus: { $in: ['CONFIRMED', 'COMPLETED'] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalBookings: { $sum: 1 },
                    checkedIn: {
                        $sum: {
                            $cond: ['$checkInStatus.checkedIn', 1, 0]
                        }
                    },
                    completed: {
                        $sum: {
                            $cond: [{ $eq: ['$bookingStatus', 'COMPLETED'] }, 1, 0]
                        }
                    }
                }
            }
        ]);
        
        const checkStats = checkInStats[0] || { totalBookings: 0, checkedIn: 0, completed: 0 };
        
        res.json({
            success: true,
            data: {
                date: targetDate.toISOString().split('T')[0],
                gym: {
                    name: `${owner.firstName} ${owner.lastName}`,
                    plan: owner.subscriptionPlan
                },
                slots: dashboardSlots,
                statistics: {
                    ...overallStats,
                    checkInRate: checkStats.totalBookings > 0 
                        ? Math.round((checkStats.checkedIn / checkStats.totalBookings) * 100)
                        : 0,
                    completionRate: checkStats.totalBookings > 0 
                        ? Math.round((checkStats.completed / checkStats.totalBookings) * 100)
                        : 0
                },
                settings: {
                    defaultCapacity,
                    slotSpecificCapacity: slotSettings.slotSpecificCapacity || {},
                    totalSlots: allSlotTimes.length,
                    enableAutoReminders: slotSettings.enableAutoReminders !== false,
                    reminderTime: slotSettings.reminderTime || "07:00"
                },
                recommendations: generateCrowdRecommendations(dashboardSlots, overallStats)
            }
        });
        
    } catch (error) {
        console.error("❌ Error loading crowd dashboard:", error);
        res.status(500).json({
            success: false,
            message: "Error loading crowd management dashboard"
        });
    }
};

// Get owner slot dashboard (legacy endpoint)
exports.getOwnerSlotDashboard = async (req, res) => {
    try {
        console.log("📊 Loading owner slot dashboard...");
        
        const ownerId = req.user.id;
        const { date } = req.query;
        
        const targetDate = date ? new Date(date) : new Date();
        targetDate.setHours(0, 0, 0, 0);
        
        // Get daily slot summary
        const dailySlots = await SlotBooking.getOwnerDailySlots(ownerId, targetDate);
        
        // Get slot capacity settings
        const owner = await Owner.findById(ownerId);
        const maxCapacity = owner?.slotSettings?.defaultCapacity || 20;
        
        // Prepare dashboard data
        const allSlotTimes = [
            "06:00-07:00", "07:00-08:00", "08:00-09:00", "09:00-10:00", "10:00-11:00",
            "11:00-12:00", "12:00-13:00", "13:00-14:00", "14:00-15:00", "15:00-16:00",
            "16:00-17:00", "17:00-18:00", "18:00-19:00", "19:00-20:00", "20:00-21:00",
            "21:00-22:00"
        ];
        
        const dashboardData = allSlotTimes.map(slotTime => {
            const slotData = dailySlots.find(slot => slot._id === slotTime);
            const currentBookings = slotData ? slotData.count : 0;
            const percentage = (currentBookings / maxCapacity) * 100;
            
            let status = "SAFE";
            let color = "🟢";
            
            if (percentage >= 90) {
                status = "CONGESTED";
                color = "🔴";
            } else if (percentage >= 70) {
                status = "ALMOST_FULL";
                color = "🟡";
            }
            
            return {
                slotTime,
                currentBookings,
                maxCapacity,
                availableSpots: Math.max(0, maxCapacity - currentBookings),
                percentage: Math.round(percentage),
                status,
                color,
                members: slotData ? slotData.members : []
            };
        });
        
        // Get today's statistics
        const todayStats = {
            totalBookings: dailySlots.reduce((sum, slot) => sum + slot.count, 0),
            totalCapacity: maxCapacity * allSlotTimes.length,
            averageOccupancy: dailySlots.length > 0 
                ? Math.round(dailySlots.reduce((sum, slot) => sum + slot.count, 0) / dailySlots.length)
                : 0
        };
        
        res.json({
            success: true,
            data: {
                date: targetDate.toISOString().split('T')[0],
                slots: dashboardData,
                statistics: todayStats,
                settings: {
                    maxCapacity,
                    totalSlots: allSlotTimes.length
                }
            }
        });
        
    } catch (error) {
        console.error("❌ Error loading dashboard:", error);
        res.status(500).json({
            success: false,
            message: "Error loading slot dashboard"
        });
    }
};

// Manual slot booking by owner
exports.manualSlotBooking = async (req, res) => {
    try {
        console.log("👤 Processing manual slot booking...");
        
        const { memberId, slotTime, date } = req.body;
        const ownerId = req.user.id;
        
        const targetDate = date ? new Date(date) : new Date();
        targetDate.setHours(0, 0, 0, 0);
        
        // Verify member belongs to owner
        const member = await Member.findOne({ _id: memberId, ownerId });
        if (!member) {
            return res.status(404).json({
                success: false,
                message: "Member not found",
                errorCode: "MEMBER_NOT_FOUND"
            });
        }
        
        // Check slot availability
        const availability = await SlotBooking.checkSlotAvailability(ownerId, targetDate, slotTime);
        if (!availability.isAvailable) {
            return res.status(400).json({
                success: false,
                message: "This slot is fully booked",
                currentBookings: availability.currentBookings,
                maxCapacity: availability.maxCapacity,
                errorCode: "SLOT_FULL"
            });
        }
        
        // Check if member already has booking for this date
        const existingBooking = await SlotBooking.findOne({
            memberId,
            ownerId,
            bookingDate: targetDate
        });
        
        if (existingBooking) {
            existingBooking.slotTime = slotTime;
            existingBooking.bookingMethod = 'MANUAL_OWNER';
            existingBooking.metadata = {
                ...existingBooking.metadata,
                bookedBy: 'owner',
                manualBookingReason: 'Owner manual booking'
            };
            await existingBooking.save();
            
            return res.json({
                success: true,
                message: `Slot updated to ${slotTime} for ${member.name}`,
                data: { booking: existingBooking, isUpdate: true }
            });
        } else {
            const newBooking = await SlotBooking.create({
                ownerId,
                memberId,
                bookingDate: targetDate,
                slotTime,
                bookingMethod: 'MANUAL_OWNER',
                metadata: {
                    bookedBy: 'owner',
                    manualBookingReason: 'Owner manual booking'
                }
            });
            
            return res.status(201).json({
                success: true,
                message: `Slot ${slotTime} booked for ${member.name}`,
                data: { booking: newBooking, isUpdate: false }
            });
        }
        
    } catch (error) {
        console.error("❌ Error with manual booking:", error);
        res.status(500).json({
            success: false,
            message: "Error processing manual booking"
        });
    }
};

// Update slot capacity settings
exports.updateSlotCapacity = async (req, res) => {
    try {
        console.log("⚙️ Updating slot capacity...");
        
        const { defaultCapacity, slotSpecificCapacity, slotTime, capacity } = req.body;
        const ownerId = req.user.id;
        
        const owner = await Owner.findById(ownerId);
        if (!owner) {
            return res.status(404).json({
                success: false,
                message: "Owner not found"
            });
        }
        
        // Initialize slotSettings if it doesn't exist
        if (!owner.slotSettings) {
            owner.slotSettings = {};
        }
        
        if (slotTime && capacity) {
            // Update capacity for specific slot
            if (!owner.slotSettings.slotSpecificCapacity) {
                owner.slotSettings.slotSpecificCapacity = {};
            }
            owner.slotSettings.slotSpecificCapacity[slotTime] = capacity;
        } else if (defaultCapacity) {
            // Update default capacity for all slots
            owner.slotSettings.defaultCapacity = defaultCapacity;
        } else if (slotSpecificCapacity) {
            // Update multiple slot capacities
            owner.slotSettings.slotSpecificCapacity = {
                ...owner.slotSettings.slotSpecificCapacity,
                ...slotSpecificCapacity
            };
        }
        
        await owner.save();
        
        const updateMessage = slotTime 
            ? `Capacity updated to ${capacity} for slot ${slotTime}`
            : defaultCapacity
                ? `Default capacity updated to ${defaultCapacity} for all slots`
                : 'Slot capacities updated successfully';
        
        res.json({
            success: true,
            message: updateMessage,
            data: {
                slotSettings: owner.slotSettings
            }
        });
        
    } catch (error) {
        console.error("❌ Error updating capacity:", error);
        res.status(500).json({
            success: false,
            message: "Error updating slot capacity"
        });
    }
};
// ===== WHATSAPP AUTOMATION FUNCTIONS =====

// Send slot booking reminders manually
exports.sendSlotReminders = async (req, res) => {
    try {
        console.log("📱 Sending slot booking reminders...");
        
        const { targetDate, memberIds, testMode = false } = req.body;
        const ownerId = req.user.id;
        
        const reminderDate = targetDate ? new Date(targetDate) : new Date();
        reminderDate.setDate(reminderDate.getDate() + 1); // Tomorrow
        reminderDate.setHours(0, 0, 0, 0);
        
        // Get members to send reminders to
        let members;
        if (memberIds && memberIds.length > 0) {
            // Send to specific members
            members = await Member.find({ 
                _id: { $in: memberIds },
                ownerId,
                paymentStatus: 'Paid'
            });
        } else {
            // Send to all active members
            members = await Member.find({ 
                ownerId,
                paymentStatus: 'Paid'
            });
        }
        
        if (members.length === 0) {
            return res.json({
                success: true,
                message: "No active members found to send reminders",
                memberCount: 0
            });
        }
        
        const results = {
            sent: 0,
            failed: 0,
            warnings: 0,
            errors: []
        };
        
        // Send reminders to each member
        for (const member of members) {
            try {
                if (testMode) {
                    console.log(`TEST MODE: Would send reminder to ${member.name} (${member.phoneNo})`);
                    results.sent++;
                } else {
                    await sendSlotBookingReminder(member, ownerId, reminderDate);
                    results.sent++;
                }
            } catch (error) {
                console.error(`Failed to send reminder to ${member.name}:`, error);
                results.failed++;
                results.errors.push({
                    member: member.name,
                    phoneNo: member.phoneNo,
                    error: error.message
                });
            }
        }
        
        res.json({
            success: true,
            message: `Slot reminders ${testMode ? 'tested' : 'sent'} successfully`,
            data: {
                targetDate: reminderDate.toISOString().split('T')[0],
                memberCount: members.length,
                results,
                testMode
            }
        });
        
    } catch (error) {
        console.error("❌ Error sending reminders:", error);
        res.status(500).json({
            success: false,
            message: "Error sending slot reminders"
        });
    }
};

// Send daily slot reminders (automated endpoint)
exports.sendDailySlotReminders = async (req, res) => {
    try {
        console.log("🔄 Processing daily slot reminders...");
        
        const ownerId = req.user.id;
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        // Get all active members for this owner
        const members = await Member.find({ 
            ownerId,
            paymentStatus: 'Paid'
        });
        
        if (members.length === 0) {
            return res.json({
                success: true,
                message: "No active members found",
                memberCount: 0
            });
        }
        
        const results = {
            sent: 0,
            failed: 0,
            autoBooked: 0,
            warnings: 0,
            errors: []
        };
        
        // Process each member
        for (const member of members) {
            try {
                // Check if member already has booking for tomorrow
                const existingBooking = await SlotBooking.findOne({
                    memberId: member._id,
                    ownerId,
                    bookingDate: tomorrow
                });
                
                if (existingBooking) {
                    console.log(`Member ${member.name} already has booking for tomorrow`);
                    continue;
                }
                
                // Check if member has ever booked
                const hasEverBooked = await SlotBooking.hasEverBooked(member._id, ownerId);
                
                if (!hasEverBooked) {
                    // Send warning message
                    await sendSlotBookingReminder(member, ownerId, tomorrow);
                    results.warnings++;
                } else {
                    // Check previous slot and auto-book or send reminder
                    const previousSlot = await SlotBooking.getMemberLastSlot(member._id, ownerId);
                    
                    if (previousSlot) {
                        // Check if previous slot is available
                        const availability = await SlotBooking.checkSlotAvailability(ownerId, tomorrow, previousSlot);
                        
                        if (availability.isAvailable) {
                            // Auto-book previous slot
                            await SlotBooking.create({
                                ownerId,
                                memberId: member._id,
                                bookingDate: tomorrow,
                                slotTime: previousSlot,
                                bookingMethod: 'PREVIOUS_SLOT',
                                crowdData: {
                                    isFromPreviousSlot: true,
                                    previousSlotTime: previousSlot,
                                    autoBooked: true
                                },
                                metadata: {
                                    bookingSource: 'auto_previous_slot'
                                }
                            });
                            
                            results.autoBooked++;
                            console.log(`Auto-booked ${previousSlot} for ${member.name}`);
                            
                            // Send confirmation message
                            const confirmMessage = `✅ *AUTO-BOOKED* ✅\n\n` +
                                                 `Hi ${member.name}!\n\n` +
                                                 `Since you didn't book manually, we've automatically assigned your usual slot:\n\n` +
                                                 `📅 Date: ${tomorrow.toLocaleDateString()}\n` +
                                                 `⏰ Time: ${previousSlot}\n\n` +
                                                 `Want to change? Use this link:\n` +
                                                 `${process.env.FRONTEND_URL}/book-slot?token=${generateSlotBookingToken(member._id, ownerId, member.name, tomorrow)}\n\n` +
                                                 `See you at the gym! 💪`;
                            
                            await sendWhatsapp(member.phoneNo, confirmMessage);
                        } else {
                            // Previous slot not available, send reminder
                            await sendSlotBookingReminder(member, ownerId, tomorrow);
                            results.sent++;
                        }
                    } else {
                        // No previous slot, send reminder
                        await sendSlotBookingReminder(member, ownerId, tomorrow);
                        results.sent++;
                    }
                }
                
            } catch (error) {
                console.error(`Failed to process ${member.name}:`, error);
                results.failed++;
                results.errors.push({
                    member: member.name,
                    error: error.message
                });
            }
        }
        
        res.json({
            success: true,
            message: "Daily slot reminders processed successfully",
            data: {
                targetDate: tomorrow.toISOString().split('T')[0],
                memberCount: members.length,
                results
            }
        });
        
    } catch (error) {
        console.error("❌ Error processing daily reminders:", error);
        res.status(500).json({
            success: false,
            message: "Error processing daily slot reminders"
        });
    }
};

// Test slot reminder message format
exports.testSlotReminderMessage = async (req, res) => {
    try {
        console.log("🧪 Testing slot reminder message...");
        
        const { memberId, testPhoneNumber } = req.body;
        const ownerId = req.user.id;
        
        // Get member details
        const member = await Member.findOne({ _id: memberId, ownerId });
        if (!member) {
            return res.status(404).json({
                success: false,
                message: "Member not found"
            });
        }
        
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        // Use test phone number if provided, otherwise use member's phone
        const phoneNumber = testPhoneNumber || member.phoneNo;
        
        try {
            // Send test reminder
            await sendSlotBookingReminder({
                ...member.toObject(),
                phoneNo: phoneNumber
            }, ownerId, tomorrow);
            
            res.json({
                success: true,
                message: `Test reminder sent successfully to ${phoneNumber}`,
                data: {
                    member: member.name,
                    phoneNumber,
                    targetDate: tomorrow.toISOString().split('T')[0]
                }
            });
            
        } catch (sendError) {
            res.status(500).json({
                success: false,
                message: "Failed to send test reminder",
                error: sendError.message
            });
        }
        
    } catch (error) {
        console.error("❌ Error testing reminder:", error);
        res.status(500).json({
            success: false,
            message: "Error testing slot reminder"
        });
    }
};

// Process previous slot auto-booking (called by cron job)
exports.processPreviousSlotBooking = async (req, res) => {
    try {
        console.log("🔄 Processing previous slot auto-booking for all gyms...");
        
        // This function runs at midnight to auto-book previous slots
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Get all owners with Advanced/Enterprise plans
        const owners = await Owner.find({
            subscriptionPlan: { $in: ['ADVANCED', 'ENTERPRISE'] },
            subscriptionExpiry: { $gte: today }
        });
        
        const results = {
            ownersProcessed: 0,
            membersProcessed: 0,
            autoBooked: 0,
            warnings: 0,
            errors: []
        };
        
        for (const owner of owners) {
            try {
                console.log(`Processing owner: ${owner.firstName} ${owner.lastName}`);
                
                // Get all active members for this owner
                const members = await Member.find({
                    ownerId: owner._id,
                    paymentStatus: 'Paid'
                });
                
                for (const member of members) {
                    try {
                        // Check if member already has booking for today
                        const existingBooking = await SlotBooking.findOne({
                            memberId: member._id,
                            ownerId: owner._id,
                            bookingDate: today
                        });
                        
                        if (existingBooking) {
                            continue; // Member already has booking
                        }
                        
                        // Check if member has ever booked
                        const hasEverBooked = await SlotBooking.hasEverBooked(member._id, owner._id);
                        
                        if (!hasEverBooked) {
                            // Increment warning count
                            const warningBooking = await SlotBooking.create({
                                ownerId: owner._id,
                                memberId: member._id,
                                bookingDate: today,
                                slotTime: '06:00-07:00', // Default morning slot
                                bookingMethod: 'PREVIOUS_SLOT',
                                bookingStatus: 'CANCELLED', // Mark as cancelled to indicate warning
                                crowdData: {
                                    warningCount: 1,
                                    isFromPreviousSlot: false,
                                    autoBooked: true
                                },
                                metadata: {
                                    bookingSource: 'warning_no_previous_slot'
                                }
                            });
                            
                            results.warnings++;
                            continue;
                        }
                        
                        // Get member's last slot
                        const previousSlot = await SlotBooking.getMemberLastSlot(member._id, owner._id);
                        
                        if (previousSlot) {
                            // Check slot availability
                            const availability = await SlotBooking.checkSlotAvailability(owner._id, today, previousSlot);
                            
                            if (availability.isAvailable) {
                                // Auto-book previous slot
                                await SlotBooking.create({
                                    ownerId: owner._id,
                                    memberId: member._id,
                                    bookingDate: today,
                                    slotTime: previousSlot,
                                    bookingMethod: 'PREVIOUS_SLOT',
                                    crowdData: {
                                        isFromPreviousSlot: true,
                                        previousSlotTime: previousSlot,
                                        autoBooked: true
                                    },
                                    metadata: {
                                        bookingSource: 'auto_previous_slot_midnight'
                                    }
                                });
                                
                                results.autoBooked++;
                                console.log(`Auto-booked ${previousSlot} for ${member.name}`);
                            }
                        }
                        
                        results.membersProcessed++;
                        
                    } catch (memberError) {
                        console.error(`Error processing member ${member.name}:`, memberError);
                        results.errors.push({
                            owner: `${owner.firstName} ${owner.lastName}`,
                            member: member.name,
                            error: memberError.message
                        });
                    }
                }
                
                results.ownersProcessed++;
                
            } catch (ownerError) {
                console.error(`Error processing owner ${owner.firstName}:`, ownerError);
                results.errors.push({
                    owner: `${owner.firstName} ${owner.lastName}`,
                    error: ownerError.message
                });
            }
        }
        
        console.log(`✅ Previous slot auto-booking completed:`, results);
        
        if (res) {
            res.json({
                success: true,
                message: "Previous slot auto-booking completed",
                data: results
            });
        }
        
        return results;
        
    } catch (error) {
        console.error("❌ Error in previous slot auto-booking:", error);
        
        if (res) {
            res.status(500).json({
                success: false,
                message: "Error processing previous slot auto-booking",
                error: error.message
            });
        }
        
        throw error;
    }
};
// ===== ANALYTICS & STATISTICS FUNCTIONS =====

// Get slot statistics and analytics
exports.getSlotStatistics = async (req, res) => {
    try {
        console.log("📈 Fetching slot statistics...");
        
        const ownerId = req.user.id;
        const { startDate, endDate, period = 'week' } = req.query;
        
        let start, end;
        const now = new Date();
        
        if (startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
        } else {
            // Default periods
            end = new Date(now);
            start = new Date(now);
            
            switch (period) {
                case 'week':
                    start.setDate(start.getDate() - 7);
                    break;
                case 'month':
                    start.setMonth(start.getMonth() - 1);
                    break;
                case 'quarter':
                    start.setMonth(start.getMonth() - 3);
                    break;
                case 'year':
                    start.setFullYear(start.getFullYear() - 1);
                    break;
                default:
                    start.setDate(start.getDate() - 7);
            }
        }
        
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        
        // Get booking statistics
        const bookingStats = await SlotBooking.aggregate([
            {
                $match: {
                    ownerId: new mongoose.Types.ObjectId(ownerId),
                    bookingDate: { $gte: start, $lte: end },
                    bookingStatus: { $in: ['CONFIRMED', 'COMPLETED', 'CANCELLED'] }
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$bookingDate" } },
                        slotTime: "$slotTime"
                    },
                    count: { $sum: 1 },
                    checkedIn: {
                        $sum: { $cond: ['$checkInStatus.checkedIn', 1, 0] }
                    },
                    completed: {
                        $sum: { $cond: [{ $eq: ['$bookingStatus', 'COMPLETED'] }, 1, 0] }
                    },
                    cancelled: {
                        $sum: { $cond: [{ $eq: ['$bookingStatus', 'CANCELLED'] }, 1, 0] }
                    },
                    methodBreakdown: { $push: '$bookingMethod' }
                }
            },
            {
                $sort: { '_id.date': 1, '_id.slotTime': 1 }
            }
        ]);
        
        // Calculate summary statistics
        const totalBookings = bookingStats.reduce((sum, stat) => sum + stat.count, 0);
        const totalCheckedIn = bookingStats.reduce((sum, stat) => sum + stat.checkedIn, 0);
        const totalCompleted = bookingStats.reduce((sum, stat) => sum + stat.completed, 0);
        const totalCancelled = bookingStats.reduce((sum, stat) => sum + stat.cancelled, 0);
        
        const checkInRate = totalBookings > 0 ? Math.round((totalCheckedIn / totalBookings) * 100) : 0;
        const completionRate = totalBookings > 0 ? Math.round((totalCompleted / totalBookings) * 100) : 0;
        const cancellationRate = totalBookings > 0 ? Math.round((totalCancelled / totalBookings) * 100) : 0;
        
        // Get most popular slots
        const slotPopularity = await SlotBooking.aggregate([
            {
                $match: {
                    ownerId: new mongoose.Types.ObjectId(ownerId),
                    bookingDate: { $gte: start, $lte: end },
                    bookingStatus: { $in: ['CONFIRMED', 'COMPLETED'] }
                }
            },
            {
                $group: {
                    _id: '$slotTime',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);
        
        res.json({
            success: true,
            data: {
                period: {
                    start: start.toISOString().split('T')[0],
                    end: end.toISOString().split('T')[0],
                    type: period
                },
                summary: {
                    totalBookings,
                    totalCheckedIn,
                    totalCompleted,
                    totalCancelled,
                    checkInRate,
                    completionRate,
                    cancellationRate,
                    averageBookingsPerDay: Math.round(totalBookings / Math.ceil((end - start) / (1000 * 60 * 60 * 24)))
                },
                slotPopularity,
                dailyBreakdown: bookingStats,
                trends: {
                    mostPopularSlot: slotPopularity[0]?._id || 'None',
                    leastPopularSlot: slotPopularity[slotPopularity.length - 1]?._id || 'None'
                }
            }
        });
        
    } catch (error) {
        console.error("❌ Error fetching statistics:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching slot statistics"
        });
    }
};

// Get crowd analytics with trends
exports.getCrowdAnalytics = async (req, res) => {
    try {
        console.log("📊 Fetching crowd analytics...");
        
        const ownerId = req.user.id;
        const { period = 'week', slotTime } = req.query;
        
        const now = new Date();
        let start = new Date(now);
        
        switch (period) {
            case 'week':
                start.setDate(start.getDate() - 7);
                break;
            case 'month':
                start.setMonth(start.getMonth() - 1);
                break;
            case 'quarter':
                start.setMonth(start.getMonth() - 3);
                break;
            default:
                start.setDate(start.getDate() - 7);
        }
        
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        
        // Build match criteria
        const matchCriteria = {
            ownerId: new mongoose.Types.ObjectId(ownerId),
            bookingDate: { $gte: start, $lte: end },
            bookingStatus: { $in: ['CONFIRMED', 'COMPLETED'] }
        };
        
        if (slotTime) {
            matchCriteria.slotTime = slotTime;
        }
        
        // Get crowd analytics
        const crowdAnalytics = await SlotBooking.aggregate([
            { $match: matchCriteria },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$bookingDate" } },
                        slotTime: "$slotTime"
                    },
                    count: { $sum: 1 },
                    checkedInCount: {
                        $sum: { $cond: ['$checkInStatus.checkedIn', 1, 0] }
                    }
                }
            },
            {
                $sort: { '_id.date': 1, '_id.slotTime': 1 }
            }
        ]);
        
        // Calculate crowd trends
        const dailyTotals = {};
        crowdAnalytics.forEach(item => {
            const date = item._id.date;
            if (!dailyTotals[date]) {
                dailyTotals[date] = { bookings: 0, checkedIn: 0 };
            }
            dailyTotals[date].bookings += item.count;
            dailyTotals[date].checkedIn += item.checkedInCount;
        });
        
        const trendData = Object.keys(dailyTotals).map(date => ({
            date,
            bookings: dailyTotals[date].bookings,
            checkedIn: dailyTotals[date].checkedIn,
            utilization: dailyTotals[date].bookings > 0 
                ? Math.round((dailyTotals[date].checkedIn / dailyTotals[date].bookings) * 100)
                : 0
        }));
        
        res.json({
            success: true,
            data: {
                period: {
                    start: start.toISOString().split('T')[0],
                    end: end.toISOString().split('T')[0],
                    type: period,
                    slotFilter: slotTime || 'All slots'
                },
                analytics: crowdAnalytics,
                trends: trendData,
                summary: {
                    totalDays: trendData.length,
                    averageBookingsPerDay: trendData.length > 0 
                        ? Math.round(trendData.reduce((sum, day) => sum + day.bookings, 0) / trendData.length)
                        : 0,
                    averageUtilization: trendData.length > 0 
                        ? Math.round(trendData.reduce((sum, day) => sum + day.utilization, 0) / trendData.length)
                        : 0
                }
            }
        });
        
    } catch (error) {
        console.error("❌ Error fetching crowd analytics:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching crowd analytics"
        });
    }
};

// Get slot booking trends
exports.getSlotTrends = async (req, res) => {
    try {
        console.log("📈 Fetching slot trends...");
        
        const ownerId = req.user.id;
        const { type = 'daily', days = 30 } = req.query;
        
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - parseInt(days));
        
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        
        let groupBy;
        switch (type) {
            case 'weekly':
                groupBy = { $week: '$bookingDate' };
                break;
            case 'monthly':
                groupBy = { $month: '$bookingDate' };
                break;
            default:
                groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$bookingDate" } };
        }
        
        const trends = await SlotBooking.aggregate([
            {
                $match: {
                    ownerId: new mongoose.Types.ObjectId(ownerId),
                    bookingDate: { $gte: start, $lte: end },
                    bookingStatus: { $in: ['CONFIRMED', 'COMPLETED'] }
                }
            },
            {
                $group: {
                    _id: {
                        period: groupBy,
                        slotTime: '$slotTime'
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.period': 1 }
            }
        ]);
        
        res.json({
            success: true,
            data: {
                trends,
                period: {
                    start: start.toISOString().split('T')[0],
                    end: end.toISOString().split('T')[0],
                    type,
                    days: parseInt(days)
                }
            }
        });
        
    } catch (error) {
        console.error("❌ Error fetching trends:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching slot trends"
        });
    }
};

// Export slot data (CSV format)
exports.exportSlotData = async (req, res) => {
    try {
        console.log("📊 Exporting slot data...");
        
        const ownerId = req.user.id;
        const { format = 'csv', startDate, endDate, includeMembers = true } = req.query;
        
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();
        
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        
        // Get booking data with member details if requested
        const pipeline = [
            {
                $match: {
                    ownerId: new mongoose.Types.ObjectId(ownerId),
                    bookingDate: { $gte: start, $lte: end }
                }
            },
            {
                $sort: { bookingDate: -1, slotTime: 1 }
            }
        ];
        
        if (includeMembers === 'true') {
            pipeline.push(
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
                }
            );
        }
        
        const bookings = await SlotBooking.aggregate(pipeline);
        
        // Format data for export
        const exportData = bookings.map(booking => ({
            Date: booking.bookingDate.toISOString().split('T')[0],
            SlotTime: booking.slotTime,
            Status: booking.bookingStatus,
            BookingMethod: booking.bookingMethod,
            CheckedIn: booking.checkInStatus?.checkedIn ? 'Yes' : 'No',
            CheckInTime: booking.checkInStatus?.checkInTime || '',
            CheckOutTime: booking.checkInStatus?.checkOutTime || '',
            MemberName: booking.member?.name || 'N/A',
            MemberPhone: booking.member?.phoneNo || 'N/A',
            CreatedAt: booking.createdAt.toISOString()
        }));
        
        if (format === 'csv') {
            // Generate CSV
            const headers = Object.keys(exportData[0] || {});
            const csvContent = [
                headers.join(','),
                ...exportData.map(row => headers.map(header => row[header]).join(','))
            ].join('\n');
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=slot-data-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.csv`);
            res.send(csvContent);
        } else {
            // Return JSON for other formats
            res.json({
                success: true,
                data: {
                    exportData,
                    summary: {
                        totalRecords: exportData.length,
                        period: {
                            start: start.toISOString().split('T')[0],
                            end: end.toISOString().split('T')[0]
                        }
                    }
                }
            });
        }
        
    } catch (error) {
        console.error("❌ Error exporting data:", error);
        res.status(500).json({
            success: false,
            message: "Error exporting slot data"
        });
    }
};

// ===== ANALYTICS & STATISTICS FUNCTIONS =====

// Get slot statistics and analytics
exports.getSlotStatistics = async (req, res) => {
    try {
        console.log("📈 Fetching slot statistics...");
        
        const ownerId = req.user.id;
        const { startDate, endDate, period = 'week' } = req.query;
        
        let start, end;
        const now = new Date();
        
        if (startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
        } else {
            // Default periods
            end = new Date(now);
            start = new Date(now);
            
            switch (period) {
                case 'week':
                    start.setDate(start.getDate() - 7);
                    break;
                case 'month':
                    start.setMonth(start.getMonth() - 1);
                    break;
                case 'quarter':
                    start.setMonth(start.getMonth() - 3);
                    break;
                case 'year':
                    start.setFullYear(start.getFullYear() - 1);
                    break;
                default:
                    start.setDate(start.getDate() - 7);
            }
        }
        
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        
        // Get booking statistics
        const bookingStats = await SlotBooking.aggregate([
            {
                $match: {
                    ownerId: new mongoose.Types.ObjectId(ownerId),
                    bookingDate: { $gte: start, $lte: end },
                    bookingStatus: { $in: ['CONFIRMED', 'COMPLETED', 'CANCELLED'] }
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$bookingDate" } },
                        slotTime: "$slotTime"
                    },
                    count: { $sum: 1 },
                    checkedIn: {
                        $sum: { $cond: ['$checkInStatus.checkedIn', 1, 0] }
                    },
                    completed: {
                        $sum: { $cond: [{ $eq: ['$bookingStatus', 'COMPLETED'] }, 1, 0] }
                    },
                    cancelled: {
                        $sum: { $cond: [{ $eq: ['$bookingStatus', 'CANCELLED'] }, 1, 0] }
                    },
                    methodBreakdown: { $push: '$bookingMethod' }
                }
            },
            {
                $sort: { '_id.date': 1, '_id.slotTime': 1 }
            }
        ]);
        
        // Calculate summary statistics
        const totalBookings = bookingStats.reduce((sum, stat) => sum + stat.count, 0);
        const totalCheckedIn = bookingStats.reduce((sum, stat) => sum + stat.checkedIn, 0);
        const totalCompleted = bookingStats.reduce((sum, stat) => sum + stat.completed, 0);
        const totalCancelled = bookingStats.reduce((sum, stat) => sum + stat.cancelled, 0);
        
        const checkInRate = totalBookings > 0 ? Math.round((totalCheckedIn / totalBookings) * 100) : 0;
        const completionRate = totalBookings > 0 ? Math.round((totalCompleted / totalBookings) * 100) : 0;
        const cancellationRate = totalBookings > 0 ? Math.round((totalCancelled / totalBookings) * 100) : 0;
        
        // Get most popular slots
        const slotPopularity = await SlotBooking.aggregate([
            {
                $match: {
                    ownerId: new mongoose.Types.ObjectId(ownerId),
                    bookingDate: { $gte: start, $lte: end },
                    bookingStatus: { $in: ['CONFIRMED', 'COMPLETED'] }
                }
            },
            {
                $group: {
                    _id: '$slotTime',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);
        
        res.json({
            success: true,
            data: {
                period: {
                    start: start.toISOString().split('T')[0],
                    end: end.toISOString().split('T')[0],
                    type: period
                },
                summary: {
                    totalBookings,
                    totalCheckedIn,
                    totalCompleted,
                    totalCancelled,
                    checkInRate,
                    completionRate,
                    cancellationRate,
                    averageBookingsPerDay: Math.round(totalBookings / Math.ceil((end - start) / (1000 * 60 * 60 * 24)))
                },
                slotPopularity,
                dailyBreakdown: bookingStats,
                trends: {
                    mostPopularSlot: slotPopularity[0]?._id || 'None',
                    leastPopularSlot: slotPopularity[slotPopularity.length - 1]?._id || 'None'
                }
            }
        });
        
    } catch (error) {
        console.error("❌ Error fetching statistics:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching slot statistics"
        });
    }
};

// Get crowd analytics with trends
exports.getCrowdAnalytics = async (req, res) => {
    try {
        console.log("📊 Fetching crowd analytics...");
        
        const ownerId = req.user.id;
        const { period = 'week', slotTime } = req.query;
        
        const now = new Date();
        let start = new Date(now);
        
        switch (period) {
            case 'week':
                start.setDate(start.getDate() - 7);
                break;
            case 'month':
                start.setMonth(start.getMonth() - 1);
                break;
            case 'quarter':
                start.setMonth(start.getMonth() - 3);
                break;
            default:
                start.setDate(start.getDate() - 7);
        }
        
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        
        // Build match criteria
        const matchCriteria = {
            ownerId: new mongoose.Types.ObjectId(ownerId),
            bookingDate: { $gte: start, $lte: end },
            bookingStatus: { $in: ['CONFIRMED', 'COMPLETED'] }
        };
        
        if (slotTime) {
            matchCriteria.slotTime = slotTime;
        }
        
        // Get crowd analytics
        const crowdAnalytics = await SlotBooking.aggregate([
            { $match: matchCriteria },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$bookingDate" } },
                        slotTime: "$slotTime"
                    },
                    count: { $sum: 1 },
                    checkedInCount: {
                        $sum: { $cond: ['$checkInStatus.checkedIn', 1, 0] }
                    }
                }
            },
            {
                $sort: { '_id.date': 1, '_id.slotTime': 1 }
            }
        ]);
        
        // Calculate crowd trends
        const dailyTotals = {};
        crowdAnalytics.forEach(item => {
            const date = item._id.date;
            if (!dailyTotals[date]) {
                dailyTotals[date] = { bookings: 0, checkedIn: 0 };
            }
            dailyTotals[date].bookings += item.count;
            dailyTotals[date].checkedIn += item.checkedInCount;
        });
        
        const trendData = Object.keys(dailyTotals).map(date => ({
            date,
            bookings: dailyTotals[date].bookings,
            checkedIn: dailyTotals[date].checkedIn,
            utilization: dailyTotals[date].bookings > 0 
                ? Math.round((dailyTotals[date].checkedIn / dailyTotals[date].bookings) * 100)
                : 0
        }));
        
        res.json({
            success: true,
            data: {
                period: {
                    start: start.toISOString().split('T')[0],
                    end: end.toISOString().split('T')[0],
                    type: period,
                    slotFilter: slotTime || 'All slots'
                },
                analytics: crowdAnalytics,
                trends: trendData,
                summary: {
                    totalDays: trendData.length,
                    averageBookingsPerDay: trendData.length > 0 
                        ? Math.round(trendData.reduce((sum, day) => sum + day.bookings, 0) / trendData.length)
                        : 0,
                    averageUtilization: trendData.length > 0 
                        ? Math.round(trendData.reduce((sum, day) => sum + day.utilization, 0) / trendData.length)
                        : 0
                }
            }
        });
        
    } catch (error) {
        console.error("❌ Error fetching crowd analytics:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching crowd analytics"
        });
    }
};

// Get slot booking trends
exports.getSlotTrends = async (req, res) => {
    try {
        console.log("📈 Fetching slot trends...");
        
        const ownerId = req.user.id;
        const { type = 'daily', days = 30 } = req.query;
        
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - parseInt(days));
        
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        
        let groupBy;
        switch (type) {
            case 'weekly':
                groupBy = { $week: '$bookingDate' };
                break;
            case 'monthly':
                groupBy = { $month: '$bookingDate' };
                break;
            default:
                groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$bookingDate" } };
        }
        
        const trends = await SlotBooking.aggregate([
            {
                $match: {
                    ownerId: new mongoose.Types.ObjectId(ownerId),
                    bookingDate: { $gte: start, $lte: end },
                    bookingStatus: { $in: ['CONFIRMED', 'COMPLETED'] }
                }
            },
            {
                $group: {
                    _id: {
                        period: groupBy,
                        slotTime: '$slotTime'
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.period': 1 }
            }
        ]);
        
        res.json({
            success: true,
            data: {
                trends,
                period: {
                    start: start.toISOString().split('T')[0],
                    end: end.toISOString().split('T')[0],
                    type,
                    days: parseInt(days)
                }
            }
        });
        
    } catch (error) {
        console.error("❌ Error fetching trends:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching slot trends"
        });
    }
};

// Export slot data (CSV format)
exports.exportSlotData = async (req, res) => {
    try {
        console.log("📊 Exporting slot data...");
        
        const ownerId = req.user.id;
        const { format = 'csv', startDate, endDate, includeMembers = true } = req.query;
        
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();
        
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        
        // Get booking data with member details if requested
        const pipeline = [
            {
                $match: {
                    ownerId: new mongoose.Types.ObjectId(ownerId),
                    bookingDate: { $gte: start, $lte: end }
                }
            },
            {
                $sort: { bookingDate: -1, slotTime: 1 }
            }
        ];
        
        if (includeMembers === 'true') {
            pipeline.push(
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
                }
            );
        }
        
        const bookings = await SlotBooking.aggregate(pipeline);
        
        // Format data for export
        const exportData = bookings.map(booking => ({
            Date: booking.bookingDate.toISOString().split('T')[0],
            SlotTime: booking.slotTime,
            Status: booking.bookingStatus,
            BookingMethod: booking.bookingMethod,
            CheckedIn: booking.checkInStatus?.checkedIn ? 'Yes' : 'No',
            CheckInTime: booking.checkInStatus?.checkInTime || '',
            CheckOutTime: booking.checkInStatus?.checkOutTime || '',
            MemberName: booking.member?.name || 'N/A',
            MemberPhone: booking.member?.phoneNo || 'N/A',
            CreatedAt: booking.createdAt.toISOString()
        }));
        
        if (format === 'csv') {
            // Generate CSV
            const headers = Object.keys(exportData[0] || {});
            const csvContent = [
                headers.join(','),
                ...exportData.map(row => headers.map(header => row[header]).join(','))
            ].join('\n');
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=slot-data-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.csv`);
            res.send(csvContent);
        } else {
            // Return JSON for other formats
            res.json({
                success: true,
                data: {
                    exportData,
                    summary: {
                        totalRecords: exportData.length,
                        period: {
                            start: start.toISOString().split('T')[0],
                            end: end.toISOString().split('T')[0]
                        }
                    }
                }
            });
        }
        
    } catch (error) {
        console.error("❌ Error exporting data:", error);
        res.status(500).json({
            success: false,
            message: "Error exporting slot data"
        });
    }
};

// ===== UTILITY FUNCTIONS FOR CRON JOBS =====

// Create daily reminder cron job function (to be called by node-cron)
exports.createDailyReminderCron = () => {
    const cron = require('node-cron');
    
    // Run every day at 7:00 AM to send reminders for tomorrow
    cron.schedule('0 7 * * *', async () => {
        try {
            console.log('🔄 Running daily slot reminder cron job...');
            
            // Get all owners with Advanced/Enterprise plans
            const owners = await Owner.find({
                subscriptionPlan: { $in: ['ADVANCED', 'ENTERPRISE'] },
                subscriptionExpiry: { $gte: new Date() }
            });
            
            for (const owner of owners) {
                try {
                    // Process reminders for this owner
                    const req = { user: { id: owner._id } };
                    const res = {
                        json: (data) => console.log(`Reminders sent for ${owner.firstName}:`, data),
                        status: () => ({ json: () => {} })
                    };
                    
                    await exports.sendDailySlotReminders(req, res);
                    
                } catch (ownerError) {
                    console.error(`Error processing reminders for ${owner.firstName}:`, ownerError);
                }
            }
            
        } catch (error) {
            console.error('❌ Daily reminder cron job error:', error);
        }
    });
    
    console.log('✅ Daily slot reminder cron job scheduled at 7:00 AM');
};

// Create midnight auto-booking cron job function  
exports.createMidnightAutoBookingCron = () => {
    const cron = require('node-cron');
    
    // Run every day at midnight to auto-book previous slots
    cron.schedule('0 0 * * *', async () => {
        try {
            console.log('🌙 Running midnight auto-booking cron job...');
            
            // Call the auto-booking function
            await exports.processPreviousSlotBooking(null, null);
            
        } catch (error) {
            console.error('❌ Midnight auto-booking cron job error:', error);
        }
    });
    
    console.log('✅ Midnight auto-booking cron job scheduled at 12:00 AM');
};

// Initialize all cron jobs
exports.initializeSlotCronJobs = () => {
    console.log('🚀 Initializing slot booking cron jobs...');
    
    // Check if cron is available
    try {
        require('node-cron');
        
        exports.createDailyReminderCron();
        exports.createMidnightAutoBookingCron();
        
        console.log('✅ All slot booking cron jobs initialized successfully');
        
    } catch (error) {
        console.error('❌ Error initializing cron jobs:', error);
        console.log('💡 Install node-cron: npm install node-cron');
    }
};

// Manual trigger for testing cron functions
exports.testCronJobs = async (req, res) => {
    try {
        console.log('🧪 Testing cron job functions...');
        
        const results = {
            reminderTest: null,
            autoBookingTest: null
        };
        
        // Test daily reminders
        try {
            const mockReq = { user: { id: req.user.id } };
            const mockRes = {
                json: (data) => {
                    results.reminderTest = data;
                    return data;
                },
                status: () => ({ json: (data) => data })
            };
            
            await exports.sendDailySlotReminders(mockReq, mockRes);
            
        } catch (reminderError) {
            results.reminderTest = { error: reminderError.message };
        }
        
        // Test auto-booking
        try {
            results.autoBookingTest = await exports.processPreviousSlotBooking(null, null);
            
        } catch (autoBookingError) {
            results.autoBookingTest = { error: autoBookingError.message };
        }
        
        res.json({
            success: true,
            message: "Cron job functions tested",
            data: results
        });
        
    } catch (error) {
        console.error("❌ Error testing cron jobs:", error);
        res.status(500).json({
            success: false,
            message: "Error testing cron job functions",
            error: error.message
        });
    }
};