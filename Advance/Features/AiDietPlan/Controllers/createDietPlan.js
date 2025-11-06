const DietPlan = require("../models/dietPlanSchema");
const Member =require("../../../../Basic/Features/MemberCrud/Models/Member")

const Owner=require("../../../../Basic/Features/MemberCrud/Models/Owner")
const {sendWhatsapp}=require("../../../../Utils/sendWhatsapp")

// Create new diet plan
exports.createDietPlan = async (req, res) => {
    try {
        const ownerId = req.user.id;
        
        const {
            planTitle,
            planType,
            targetAudience,
            planDuration,
            targetGoals,
            mealPlan,
            generalInstructions,
            dosList,
            dontsList,
            waterIntake,
            supplements,
            validFrom,
            validTill
        } = req.body;
        
        // Validate required fields
        if (!planTitle || !mealPlan) {
            return res.status(400).json({
                success: false,
                message: "Plan title and meal plan are required"
            });
        }
        
        // Create new diet plan
        const dietPlan = await DietPlan.create({
            ownerId,
            planTitle,
            planType: planType || 'General Health',
            targetAudience: targetAudience || 'All Members',
            planDuration: planDuration || '1 month',
            targetGoals,
            mealPlan,
            generalInstructions,
            dosList: dosList || [],
            dontsList: dontsList || [],
            waterIntake: waterIntake || "3-4 liters daily",
            supplements: supplements || [],
            validFrom: validFrom || new Date(),
            validTill,
            status: 'Draft'
        });
        
        return res.status(201).json({
            success: true,
            message: "Diet plan created successfully",
            data: dietPlan
        });
        
    } catch (error) {
        console.error("Error creating diet plan:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create diet plan",
            error: error.message
        });
    }
};

// Get all diet plans for owner
exports.getAllDietPlans = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const { status, page = 1, limit = 10 } = req.query;
        
        const query = { ownerId };
        if (status) {
            query.status = status;
        }
        
        const skip = (page - 1) * limit;
        
        const dietPlans = await DietPlan.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        
        const total = await DietPlan.countDocuments(query);
        
        return res.status(200).json({
            success: true,
            data: dietPlans,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
        
    } catch (error) {
        console.error("Error fetching diet plans:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch diet plans",
            error: error.message
        });
    }
};

// Get single diet plan by ID
exports.getDietPlanById = async (req, res) => {
    try {
        const { planId } = req.params;
        const ownerId = req.user.id;
        
        const dietPlan = await DietPlan.findOne({
            _id: planId,
            ownerId
        });
        
        if (!dietPlan) {
            return res.status(404).json({
                success: false,
                message: "Diet plan not found"
            });
        }
        
        return res.status(200).json({
            success: true,
            data: dietPlan
        });
        
    } catch (error) {
        console.error("Error fetching diet plan:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch diet plan",
            error: error.message
        });
    }
};

// Update diet plan
exports.updateDietPlan = async (req, res) => {
    try {
        const { planId } = req.params;
        const ownerId = req.user.id;
        const updateData = req.body;
        
        const dietPlan = await DietPlan.findOne({
            _id: planId,
            ownerId
        });
        
        if (!dietPlan) {
            return res.status(404).json({
                success: false,
                message: "Diet plan not found"
            });
        }
        
        // Update version
        updateData.version = dietPlan.version + 1;
        
        const updatedPlan = await DietPlan.findByIdAndUpdate(
            planId,
            updateData,
            { new: true, runValidators: true }
        );
        
        return res.status(200).json({
            success: true,
            message: "Diet plan updated successfully",
            data: updatedPlan
        });
        
    } catch (error) {
        console.error("Error updating diet plan:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update diet plan",
            error: error.message
        });
    }
};

// Delete diet plan
exports.deleteDietPlan = async (req, res) => {
    try {
        const { planId } = req.params;
        const ownerId = req.user.id;
        
        const dietPlan = await DietPlan.findOneAndDelete({
            _id: planId,
            ownerId
        });
        
        if (!dietPlan) {
            return res.status(404).json({
                success: false,
                message: "Diet plan not found"
            });
        }
        
        return res.status(200).json({
            success: true,
            message: "Diet plan deleted successfully"
        });
        
    } catch (error) {
        console.error("Error deleting diet plan:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete diet plan",
            error: error.message
        });
    }
};

// MAIN FEATURE: Broadcast diet plan to all members
exports.broadcastDietPlan = async (req, res) => {
    try {
        const { planId } = req.params;
        const ownerId = req.user.id;
        const { filterGender, filterStatus } = req.body; // Optional filters
        
        // Find diet plan
        const dietPlan = await DietPlan.findOne({
            _id: planId,
            ownerId
        });
        
        if (!dietPlan) {
            return res.status(404).json({
                success: false,
                message: "Diet plan not found"
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
                message: "No members found to send diet plan"
            });
        }
        
        // Track feature usage
        await owner.trackFeatureUsage('whatsappReminders');
        
        // Start broadcast
        await dietPlan.startBroadcast(members.length);
        
        // Send to all members
        let successCount = 0;
        let failedCount = 0;
        const deliveryResults = [];
        
        for (const member of members) {
            try {
                // Get personalized message
                const message = dietPlan.getWhatsAppMessage(member.name);
                
                // Send WhatsApp message
                const result = await sendWhatsapp(member.phoneNo, message);
                
                // Log successful delivery
                await dietPlan.logDelivery(
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
                await dietPlan.logDelivery(
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
        
        // Get updated diet plan with stats
        const updatedPlan = await DietPlan.findById(planId);
        
        return res.status(200).json({
            success: true,
            message: "Diet plan broadcast completed",
            data: {
                planId: dietPlan._id,
                planTitle: dietPlan.planTitle,
                totalMembers: members.length,
                successfulDeliveries: successCount,
                failedDeliveries: failedCount,
                successRate: ((successCount / members.length) * 100).toFixed(2) + '%',
                deliveryDetails: deliveryResults,
                stats: updatedPlan.getDeliveryStats()
            }
        });
        
    } catch (error) {
        console.error("Error broadcasting diet plan:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to broadcast diet plan",
            error: error.message
        });
    }
};

// Get delivery statistics for a diet plan
exports.getDietPlanStats = async (req, res) => {
    try {
        const { planId } = req.params;
        const ownerId = req.user.id;
        
        const dietPlan = await DietPlan.findOne({
            _id: planId,
            ownerId
        });
        
        if (!dietPlan) {
            return res.status(404).json({
                success: false,
                message: "Diet plan not found"
            });
        }
        
        const stats = dietPlan.getDeliveryStats();
        
        return res.status(200).json({
            success: true,
            data: {
                planTitle: dietPlan.planTitle,
                planType: dietPlan.planType,
                status: dietPlan.status,
                ...stats,
                recentDeliveries: dietPlan.deliveryLog.slice(-10) // Last 10 deliveries
            }
        });
        
    } catch (error) {
        console.error("Error fetching diet plan stats:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch stats",
            error: error.message
        });
    }
};

// Preview diet plan message (without sending)
exports.previewDietPlanMessage = async (req, res) => {
    try {
        const { planId } = req.params;
        const ownerId = req.user.id;
        
        const dietPlan = await DietPlan.findOne({
            _id: planId,
            ownerId
        });
        
        if (!dietPlan) {
            return res.status(404).json({
                success: false,
                message: "Diet plan not found"
            });
        }
        
        // Get a sample member name or use generic
        const sampleMember = await Member.findOne({ ownerId }).limit(1);
        const sampleName = sampleMember ? sampleMember.name : "Member";
        
        const message = dietPlan.getWhatsAppMessage(sampleName);
        
        return res.status(200).json({
            success: true,
            data: {
                message,
                characterCount: message.length,
                estimatedSMS: Math.ceil(message.length / 160)
            }
        });
        
    } catch (error) {
        console.error("Error previewing diet plan:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to preview diet plan",
            error: error.message
        });
    }
};