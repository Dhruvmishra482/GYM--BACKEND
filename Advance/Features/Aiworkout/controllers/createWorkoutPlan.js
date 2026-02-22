const WorkoutPlan = require("../models/workoutPlanSchema");
const Member = require("../../../../Basic/Features/MemberCrud/Models/Member");
const Owner = require("../../../../Basic/Features/MemberCrud/Models/Owner");
const sendWhatsapp = require("../../../../Utils/sendWhatsapp");

// Create new workout plan
exports.createWorkoutPlan = async (req, res) => {
    try {
        const ownerId = req.user.id;
        
        const {
            planTitle,
            planType,
            targetAudience,
            difficultyLevel,
            planDuration,
            workoutsPerWeek,
            targetGoals,
            weeklySchedule,
            generalInstructions,
            importantTips,
            safetyGuidelines,
            progressionNotes,
            recoveryTips,
            validFrom,
            validTill
        } = req.body;
        
        // Validate required fields
        if (!planTitle || !weeklySchedule) {
            return res.status(400).json({
                success: false,
                message: "Plan title and weekly schedule are required"
            });
        }
        
        // Create new workout plan
        const workoutPlan = await WorkoutPlan.create({
            ownerId,
            planTitle,
            planType: planType || 'General Fitness',
            targetAudience: targetAudience || 'All Members',
            difficultyLevel: difficultyLevel || 'Beginner',
            planDuration: planDuration || '4 weeks',
            workoutsPerWeek: workoutsPerWeek || 4,
            targetGoals,
            weeklySchedule,
            generalInstructions,
            importantTips: importantTips || [],
            safetyGuidelines: safetyGuidelines || [],
            progressionNotes,
            recoveryTips: recoveryTips || [],
            validFrom: validFrom || new Date(),
            validTill,
            status: 'Draft'
        });
        
        return res.status(201).json({
            success: true,
            message: "Workout plan created successfully",
            data: workoutPlan
        });
        
    } catch (error) {
        console.error("Error creating workout plan:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create workout plan",
            error: error.message
        });
    }
};

// Get all workout plans for owner
exports.getAllWorkoutPlans = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const { status, page = 1, limit = 10 } = req.query;
        
        const query = { ownerId };
        if (status) {
            query.status = status;
        }
        
        const skip = (page - 1) * limit;
        
        let workoutPlans = await WorkoutPlan.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean(); // Use .lean() for plain JavaScript objects, then manually transform

        // Transform weeklySchedule to ensure consistency for frontend
        workoutPlans = workoutPlans.map(plan => {
            if (plan.weeklySchedule && typeof plan.weeklySchedule === 'object') {
                const transformedSchedule = {};
                for (const day in plan.weeklySchedule) {
                    // Check if a day's schedule is a string and convert it to an object
                    if (typeof plan.weeklySchedule[day] === 'string') {
                        transformedSchedule[day] = { focus: plan.weeklySchedule[day] };
                    } else {
                        transformedSchedule[day] = plan.weeklySchedule[day];
                    }
                }
                return { ...plan, weeklySchedule: transformedSchedule };
            }
            return plan;
        });
        
        const total = await WorkoutPlan.countDocuments(query);
        
        return res.status(200).json({
            success: true,
            data: workoutPlans,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
        
    } catch (error) {
        console.error("Error fetching workout plans:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch workout plans",
            error: error.message
        });
    }
};

// Get single workout plan by ID
exports.getWorkoutPlanById = async (req, res) => {
    try {
        const { planId } = req.params;
        const ownerId = req.user.id;
        
        const workoutPlan = await WorkoutPlan.findOne({
            _id: planId,
            ownerId
        });
        
        if (!workoutPlan) {
            return res.status(404).json({
                success: false,
                message: "Workout plan not found"
            });
        }
        
        return res.status(200).json({
            success: true,
            data: workoutPlan
        });
        
    } catch (error) {
        console.error("Error fetching workout plan:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch workout plan",
            error: error.message
        });
    }
};

// Update workout plan
exports.updateWorkoutPlan = async (req, res) => {
    try {
        const { planId } = req.params;
        const ownerId = req.user.id;
        const updateData = req.body;
        
        const workoutPlan = await WorkoutPlan.findOne({
            _id: planId,
            ownerId
        });
        
        if (!workoutPlan) {
            return res.status(404).json({
                success: false,
                message: "Workout plan not found"
            });
        }
        
        // Transform weeklySchedule to match schema
        if (updateData.weeklySchedule && typeof updateData.weeklySchedule === 'object') {
            const transformedSchedule = {};
            const dayMapping = {
                'Mon': 'monday', 'Tue': 'tuesday', 'Wed': 'wednesday', 'Thu': 'thursday',
                'Fri': 'friday', 'Sat': 'saturday', 'Sun': 'sunday'
            };

            for (const dayAbbr in updateData.weeklySchedule) {
                const dayFull = dayMapping[dayAbbr];
                if (dayFull) {
                    const existingDaySchedule = workoutPlan.weeklySchedule[dayFull] || {};
                    const incomingDayData = updateData.weeklySchedule[dayAbbr];

                    // Ensure incomingDayData is an object before spreading
                    const validIncomingDayData = typeof incomingDayData === 'object' && incomingDayData !== null
                        ? incomingDayData
                        : {};

                    transformedSchedule[dayFull] = {
                        ...existingDaySchedule,
                        ...validIncomingDayData
                    };
                }
            }
            updateData.weeklySchedule = transformedSchedule;
        }
        
        // Update version safely, default to 0 if not present
        updateData.version = (workoutPlan.version || 0) + 1;
        
        const updatedPlan = await WorkoutPlan.findByIdAndUpdate(
            planId,
            updateData,
            { new: true, runValidators: true }
        );
        
        return res.status(200).json({
            success: true,
            message: "Workout plan updated successfully",
            data: updatedPlan
        });
        
    } catch (error) {
        console.error("Error updating workout plan:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update workout plan",
            errorMessage: error.message, // Include specific error message for debugging
            errorStack: error.stack // Include error stack for more detailed debugging
        });
    }
};

// Delete workout plan
exports.deleteWorkoutPlan = async (req, res) => {
    try {
        const { planId } = req.params;
        const ownerId = req.user.id;
        
        const workoutPlan = await WorkoutPlan.findOneAndDelete({
            _id: planId,
            ownerId
        });
        
        if (!workoutPlan) {
            return res.status(404).json({
                success: false,
                message: "Workout plan not found"
            });
        }
        
        return res.status(200).json({
            success: true,
            message: "Workout plan deleted successfully"
        });
        
    } catch (error) {
        console.error("Error deleting workout plan:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete workout plan",
            error: error.message
        });
    }
};

// MAIN FEATURE: Broadcast workout plan to all members
exports.broadcastWorkoutPlan = async (req, res) => {
    try {
        const { planId } = req.params;
        const ownerId = req.user.id;
        const { filterGender, filterStatus, filterLevel } = req.body;
        
        // Find workout plan
        const workoutPlan = await WorkoutPlan.findOne({
            _id: planId,
            ownerId
        });
        
        if (!workoutPlan) {
            return res.status(404).json({
                success: false,
                message: "Workout plan not found"
            });
        }
        
        // Get owner's gym details
        const owner = await Owner.findById(ownerId);
        
        // Build member query
        const memberQuery = { ownerId };
        
        // Apply filters if provided
        if (filterGender && filterGender !== 'All') {
            memberQuery.gender = filterGender;
        }
        
        if (filterStatus && filterStatus !== 'All') {
            memberQuery.paymentStatus = filterStatus;
        }
        
        // Get all members
        const members = await Member.find(memberQuery);
        
        if (members.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No members found to send workout plan"
            });
        }
        
        // Track feature usage
        await owner.trackFeatureUsage('workoutRecommendations');
        
        // Start broadcast
        await workoutPlan.startBroadcast(members.length);
        
        // Send to all members
        let successCount = 0;
        let failedCount = 0;
        const deliveryResults = [];
        
        for (const member of members) {
            try {
                // Get personalized message
                const message = workoutPlan.getWhatsAppMessage(member.name);
                
                // Send WhatsApp message
                const result = await sendWhatsapp(member.phoneNo, message);
                
                // Log successful delivery
                await workoutPlan.logDelivery(
                    member,
                    'sent',
                    null,
                    result.sid
                );
                
                successCount++;
                deliveryResults.push({
                    memberId: member._id,
                    name: member.name,
                    phone: member.phoneNo,
                    status: 'sent',
                    messageSid: result.sid
                });
                
                // Small delay to avoid rate limits (100ms)
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                // Log failed delivery
                await workoutPlan.logDelivery(
                    member,
                    'failed',
                    error.message || 'Failed to send WhatsApp'
                );
                
                failedCount++;
                deliveryResults.push({
                    memberId: member._id,
                    name: member.name,
                    phone: member.phoneNo,
                    status: 'failed',
                    error: error.message
                });
                
                console.error(`Failed to send to ${member.name}:`, error.message);
            }
        }
        
        // Get updated workout plan with stats
        const updatedPlan = await WorkoutPlan.findById(planId);
        
        return res.status(200).json({
            success: true,
            message: "Workout plan broadcast completed",
            data: {
                planId: workoutPlan._id,
                planTitle: workoutPlan.planTitle,
                totalMembers: members.length,
                successfulDeliveries: successCount,
                failedDeliveries: failedCount,
                successRate: ((successCount / members.length) * 100).toFixed(2) + '%',
                deliveryDetails: deliveryResults,
                stats: updatedPlan.getDeliveryStats()
            }
        });
        
    } catch (error) {
        console.error("Error broadcasting workout plan:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to broadcast workout plan",
            error: error.message
        });
    }
};

// Get delivery statistics for a workout plan
exports.getWorkoutPlanStats = async (req, res) => {
    try {
        const { planId } = req.params;
        const ownerId = req.user.id;
        
        const workoutPlan = await WorkoutPlan.findOne({
            _id: planId,
            ownerId
        });
        
        if (!workoutPlan) {
            return res.status(404).json({
                success: false,
                message: "Workout plan not found"
            });
        }
        
        const stats = workoutPlan.getDeliveryStats();
        
        return res.status(200).json({
            success: true,
            data: {
                planTitle: workoutPlan.planTitle,
                planType: workoutPlan.planType,
                difficultyLevel: workoutPlan.difficultyLevel,
                status: workoutPlan.status,
                ...stats,
                recentDeliveries: workoutPlan.deliveryLog.slice(-10)
            }
        });
        
    } catch (error) {
        console.error("Error fetching workout plan stats:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch stats",
            error: error.message
        });
    }
};

// Preview workout plan message (without sending)
exports.previewWorkoutPlanMessage = async (req, res) => {
    try {
        const { planId } = req.params;
        const ownerId = req.user.id;
        
        const workoutPlan = await WorkoutPlan.findOne({
            _id: planId,
            ownerId
        });
        
        if (!workoutPlan) {
            return res.status(404).json({
                success: false,
                message: "Workout plan not found"
            });
        }
        
        // Get a sample member name or use generic
        const sampleMember = await Member.findOne({ ownerId }).limit(1);
        const sampleName = sampleMember ? sampleMember.name : "Member";
        
        const message = workoutPlan.getWhatsAppMessage(sampleName);
        
        return res.status(200).json({
            success: true,
            data: {
                message,
                characterCount: message.length,
                estimatedSMS: Math.ceil(message.length / 160)
            }
        });
        
    } catch (error) {
        console.error("Error previewing workout plan:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to preview workout plan",
            error: error.message
        });
    }
};