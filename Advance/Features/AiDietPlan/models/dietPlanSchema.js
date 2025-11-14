const mongoose = require("mongoose");

const dietPlanSchema = new mongoose.Schema({
    // Owner reference for data isolation
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Owner',
        required: true,
        index: true
    },
    
    // Diet plan details
    planTitle: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
        default: "Personalized Diet Plan"
    },
    
    planType: {
        type: String,
        enum: ['Weight Loss', 'Weight Gain', 'Muscle Building', 'Maintenance', 'General Health', 'Custom'],
        default: 'General Health'
    },
    
    // Target audience for this plan
    targetAudience: {
        type: String,
        enum: ['All Members', 'Male Only', 'Female Only', 'Beginners', 'Advanced', 'Custom Selection'],
        default: 'All Members'
    },
    
    // Duration of plan
    planDuration: {
        type: String,
        enum: ['1 week', '2 weeks', '1 month', '3 months', 'Ongoing'],
        default: '1 month'
    },
    
    // General target goals (applicable to all)
    targetGoals: {
        description: String,
        dailyCaloriesRange: {
            min: Number,
            max: Number
        },
        generalNotes: String
    },
    
    // Daily meal structure
    mealPlan: {
        // Early Morning (5-6 AM)
        earlyMorning: {
            time: {
                type: String,
                default: "6:00 AM"
            },
            items: [{
                type: String
            }],
            notes: String
        },
        
        // Breakfast (7-9 AM)
        breakfast: {
            time: {
                type: String,
                default: "8:00 AM"
            },
            items: [{
                type: String
            }],
            notes: String
        },
        
        // Mid Morning (10-11 AM)
        midMorning: {
            time: {
                type: String,
                default: "10:30 AM"
            },
            items: [{
                type: String
            }],
            notes: String
        },
        
        // Lunch (12-2 PM)
        lunch: {
            time: {
                type: String,
                default: "1:00 PM"
            },
            items: [{
                type: String
            }],
            notes: String
        },
        
        // Evening Snack (4-5 PM)
        eveningSnack: {
            time: {
                type: String,
                default: "4:30 PM"
            },
            items: [{
                type: String
            }],
            notes: String
        },
        
        // Dinner (7-9 PM)
        dinner: {
            time: {
                type: String,
                default: "8:00 PM"
            },
            items: [{
                type: String
            }],
            notes: String
        },
        
        // Before Bed (Optional)
        beforeBed: {
            time: {
                type: String,
                default: "10:00 PM"
            },
            items: [{
                type: String
            }],
            notes: String
        }
    },
    
    // General instructions and notes
    generalInstructions: {
        type: String,
        maxlength: 2000
    },
    
    // Do's and Don'ts
    dosList: [{
        type: String
    }],
    
    dontsList: [{
        type: String
    }],
    
    // Hydration reminder
    waterIntake: {
        type: String,
        default: "3-4 liters daily"
    },
    
    // Supplements (if any)
    supplements: [{
        name: String,
        timing: String,
        dosage: String
    }],
    
    // Status tracking
    status: {
        type: String,
        enum: ['Draft', 'Active', 'Archived'],
        default: 'Draft'
    },
    
    // Broadcast tracking - Sabhi members ko bhejne ke liye
    broadcastDetails: {
        totalMembersSent: {
            type: Number,
            default: 0
        },
        successfulDeliveries: {
            type: Number,
            default: 0
        },
        failedDeliveries: {
            type: Number,
            default: 0
        },
        lastBroadcastAt: {
            type: Date
        },
        broadcastHistory: [{
            sentAt: Date,
            totalMembers: Number,
            successCount: Number,
            failedCount: Number,
            memberIds: [mongoose.Schema.Types.ObjectId]
        }]
    },
    
    // Individual member delivery tracking
    deliveryLog: [{
        memberId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Member'
        },
        memberName: String,
        memberPhone: String,
        sentAt: Date,
        status: {
            type: String,
            enum: ['sent', 'delivered', 'failed'],
            default: 'sent'
        },
        errorMessage: String,
        twilioMessageSid: String
    }],
    
    // Plan validity
    validFrom: {
        type: Date,
        default: Date.now
    },
    
    validTill: {
        type: Date
    },
    
    // Version control for updates
    version: {
        type: Number,
        default: 1
    }
    
}, {
    timestamps: true
});

// Indexes for better query performance
dietPlanSchema.index({ ownerId: 1, status: 1 });
dietPlanSchema.index({ ownerId: 1, createdAt: -1 });

// Method to log delivery for a member
dietPlanSchema.methods.logDelivery = function(member, status, errorMessage = null, twilioSid = null) {
    this.deliveryLog.push({
        memberId: member._id,
        memberName: member.name,
        memberPhone: member.phoneNo,
        sentAt: new Date(),
        status: status,
        errorMessage: errorMessage,
        twilioMessageSid: twilioSid
    });
    
    // Update broadcast stats
    this.broadcastDetails.totalMembersSent += 1;
    if (status === 'sent' || status === 'delivered') {
        this.broadcastDetails.successfulDeliveries += 1;
    } else {
        this.broadcastDetails.failedDeliveries += 1;
    }
    
    return this.save();
};

// Method to start new broadcast
dietPlanSchema.methods.startBroadcast = function(totalMembers) {
    this.broadcastDetails.lastBroadcastAt = new Date();
    this.status = 'Active';
    return this.save();
};

// Method to get formatted diet plan for WhatsApp
dietPlanSchema.methods.getWhatsAppMessage = function(memberName = null) {
    const gymName = "🏋️ YOUR GYM NAME"; // This will be dynamic from owner's gym details
    
    let message = `━━━━━━━━━━━━━━━━\n`;
    message += `🥗 *${this.planTitle.toUpperCase()}*\n`;
    message += `━━━━━━━━━━━━━━━━\n\n`;
    
    if (memberName) {
        message += `👤 Hello *${memberName}*!\n\n`;
    }
    
    message += `📋 *Plan Type:* ${this.planType}\n`;
    message += `⏳ *Duration:* ${this.planDuration}\n\n`;
    
    // Target goals
    if (this.targetGoals && this.targetGoals.description) {
        message += `🎯 *Goal:* ${this.targetGoals.description}\n\n`;
    }
    
    // Meal plan
    message += `📅 *YOUR DAILY MEAL PLAN*\n`;
    message += `━━━━━━━━━━━━━━━━\n\n`;
    
    const meals = [
        { key: 'earlyMorning', title: '🌅 Early Morning', time: this.mealPlan.earlyMorning?.time },
        { key: 'breakfast', title: '🍳 Breakfast', time: this.mealPlan.breakfast?.time },
        { key: 'midMorning', title: '☕ Mid Morning', time: this.mealPlan.midMorning?.time },
        { key: 'lunch', title: '🍱 Lunch', time: this.mealPlan.lunch?.time },
        { key: 'eveningSnack', title: '🥤 Evening Snack', time: this.mealPlan.eveningSnack?.time },
        { key: 'dinner', title: '🍽️ Dinner', time: this.mealPlan.dinner?.time },
        { key: 'beforeBed', title: '🌙 Before Bed', time: this.mealPlan.beforeBed?.time }
    ];
    
    meals.forEach(meal => {
        const mealData = this.mealPlan[meal.key];
        if (mealData && mealData.items && mealData.items.length > 0) {
            message += `*${meal.title}* (${meal.time || 'Flexible'})\n`;
            mealData.items.forEach(item => {
                message += `  • ${item}\n`;
            });
            if (mealData.notes) {
                message += `  _Note: ${mealData.notes}_\n`;
            }
            message += `\n`;
        }
    });
    
    // Hydration
    if (this.waterIntake) {
        message += `💧 *Water Intake:* ${this.waterIntake}\n\n`;
    }
    
    // Supplements
    if (this.supplements && this.supplements.length > 0) {
        message += `💊 *Supplements:*\n`;
        this.supplements.forEach(supp => {
            message += `  • ${supp.name} - ${supp.timing}`;
            if (supp.dosage) message += ` (${supp.dosage})`;
            message += `\n`;
        });
        message += `\n`;
    }
    
    // Do's
    if (this.dosList && this.dosList.length > 0) {
        message += `✅ *DO's:*\n`;
        this.dosList.forEach(item => {
            message += `  ✓ ${item}\n`;
        });
        message += `\n`;
    }
    
    // Don'ts
    if (this.dontsList && this.dontsList.length > 0) {
        message += `❌ *DON'Ts:*\n`;
        this.dontsList.forEach(item => {
            message += `  ✗ ${item}\n`;
        });
        message += `\n`;
    }
    
    // General instructions
    if (this.generalInstructions) {
        message += `📝 *Important Notes:*\n${this.generalInstructions}\n\n`;
    }
    
    message += `━━━━━━━━━━━━━━━━\n`;
    message += `💪 Stay consistent & achieve your goals!\n`;
    message += `\n_Sent from ${gymName}_`;
    
    return message;
};

// Method to get delivery statistics
dietPlanSchema.methods.getDeliveryStats = function() {
    return {
        totalSent: this.broadcastDetails.totalMembersSent,
        successful: this.broadcastDetails.successfulDeliveries,
        failed: this.broadcastDetails.failedDeliveries,
        successRate: this.broadcastDetails.totalMembersSent > 0 
            ? ((this.broadcastDetails.successfulDeliveries / this.broadcastDetails.totalMembersSent) * 100).toFixed(2) 
            : 0,
        lastBroadcast: this.broadcastDetails.lastBroadcastAt
    };
};

module.exports = mongoose.model("DietPlan", dietPlanSchema);