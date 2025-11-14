const mongoose = require("mongoose");

const workoutPlanSchema = new mongoose.Schema({
    // Owner reference for data isolation
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Owner',
        required: true,
        index: true
    },
    
    // Workout plan details
    planTitle: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
        default: "Personalized Workout Plan"
    },
    
    planType: {
        type: String,
        enum: ['Strength Training', 'Cardio Focus', 'Weight Loss', 'Muscle Building', 'Endurance', 'General Fitness', 'Custom'],
        default: 'General Fitness'
    },
    
    // Target audience for this plan
    targetAudience: {
        type: String,
        enum: ['All Members', 'Male Only', 'Female Only', 'Beginners', 'Intermediate', 'Advanced', 'Custom Selection'],
        default: 'All Members'
    },
    
    // Difficulty level
    difficultyLevel: {
        type: String,
        enum: ['Beginner', 'Intermediate', 'Advanced'],
        default: 'Beginner'
    },
    
    // Duration of plan
    planDuration: {
        type: String,
        enum: ['1 week', '2 weeks', '4 weeks', '8 weeks', '12 weeks', 'Ongoing'],
        default: '4 weeks'
    },
    
    // Workout frequency
    workoutsPerWeek: {
        type: Number,
        min: 1,
        max: 7,
        default: 4
    },
    
    // General target goals
    targetGoals: {
        description: String,
        primaryGoal: {
            type: String,
            enum: ['Build Muscle', 'Lose Weight', 'Increase Strength', 'Improve Endurance', 'General Fitness', 'Athletic Performance']
        },
        estimatedTimePerSession: String, // e.g., "60-90 minutes"
        generalNotes: String
    },
    
    // Weekly workout structure
    weeklySchedule: {
        monday: {
            restDay: {
                type: Boolean,
                default: false
            },
            focus: String, // e.g., "Chest & Triceps"
            exercises: [{
                name: String,
                sets: Number,
                reps: String, // Can be "8-12" or "30 seconds"
                rest: String, // e.g., "60 seconds"
                notes: String,
                videoUrl: String
            }],
            warmup: String,
            cooldown: String,
            cardio: String
        },
        
        tuesday: {
            restDay: {
                type: Boolean,
                default: false
            },
            focus: String,
            exercises: [{
                name: String,
                sets: Number,
                reps: String,
                rest: String,
                notes: String,
                videoUrl: String
            }],
            warmup: String,
            cooldown: String,
            cardio: String
        },
        
        wednesday: {
            restDay: {
                type: Boolean,
                default: false
            },
            focus: String,
            exercises: [{
                name: String,
                sets: Number,
                reps: String,
                rest: String,
                notes: String,
                videoUrl: String
            }],
            warmup: String,
            cooldown: String,
            cardio: String
        },
        
        thursday: {
            restDay: {
                type: Boolean,
                default: false
            },
            focus: String,
            exercises: [{
                name: String,
                sets: Number,
                reps: String,
                rest: String,
                notes: String,
                videoUrl: String
            }],
            warmup: String,
            cooldown: String,
            cardio: String
        },
        
        friday: {
            restDay: {
                type: Boolean,
                default: false
            },
            focus: String,
            exercises: [{
                name: String,
                sets: Number,
                reps: String,
                rest: String,
                notes: String,
                videoUrl: String
            }],
            warmup: String,
            cooldown: String,
            cardio: String
        },
        
        saturday: {
            restDay: {
                type: Boolean,
                default: false
            },
            focus: String,
            exercises: [{
                name: String,
                sets: Number,
                reps: String,
                rest: String,
                notes: String,
                videoUrl: String
            }],
            warmup: String,
            cooldown: String,
            cardio: String
        },
        
        sunday: {
            restDay: {
                type: Boolean,
                default: true
            },
            focus: String,
            exercises: [{
                name: String,
                sets: Number,
                reps: String,
                rest: String,
                notes: String,
                videoUrl: String
            }],
            warmup: String,
            cooldown: String,
            cardio: String
        }
    },
    
    // General instructions and notes
    generalInstructions: {
        type: String,
        maxlength: 2000
    },
    
    // Important tips
    importantTips: [{
        type: String
    }],
    
    // Safety guidelines
    safetyGuidelines: [{
        type: String
    }],
    
    // Progression plan
    progressionNotes: {
        type: String,
        maxlength: 1000
    },
    
    // Recovery recommendations
    recoveryTips: [{
        type: String
    }],
    
    // Status tracking
    status: {
        type: String,
        enum: ['Draft', 'Active', 'Archived'],
        default: 'Draft'
    },
    
    // Broadcast tracking
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
workoutPlanSchema.index({ ownerId: 1, status: 1 });
workoutPlanSchema.index({ ownerId: 1, createdAt: -1 });

// Method to log delivery for a member
workoutPlanSchema.methods.logDelivery = function(member, status, errorMessage = null, twilioSid = null) {
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
workoutPlanSchema.methods.startBroadcast = function(totalMembers) {
    this.broadcastDetails.lastBroadcastAt = new Date();
    this.status = 'Active';
    return this.save();
};

// Method to get formatted workout plan for WhatsApp
workoutPlanSchema.methods.getWhatsAppMessage = function(memberName = null) {
    const gymName = "🏋️ YOUR GYM NAME";
    
    let message = `━━━━━━━━━━━━━━━━\n`;
    message += `💪 *${this.planTitle.toUpperCase()}*\n`;
    message += `━━━━━━━━━━━━━━━━\n\n`;
    
    if (memberName) {
        message += `👤 Hello *${memberName}*!\n\n`;
    }
    
    message += `📋 *Plan Type:* ${this.planType}\n`;
    message += `🎯 *Level:* ${this.difficultyLevel}\n`;
    message += `⏳ *Duration:* ${this.planDuration}\n`;
    message += `📅 *Frequency:* ${this.workoutsPerWeek} days/week\n\n`;
    
    // Target goals
    if (this.targetGoals && this.targetGoals.description) {
        message += `🎯 *Goal:* ${this.targetGoals.description}\n\n`;
    }
    
    // Weekly schedule
    message += `📅 *YOUR WEEKLY WORKOUT PLAN*\n`;
    message += `━━━━━━━━━━━━━━━━\n\n`;
    
    const days = [
        { key: 'monday', title: '📌 MONDAY' },
        { key: 'tuesday', title: '📌 TUESDAY' },
        { key: 'wednesday', title: '📌 WEDNESDAY' },
        { key: 'thursday', title: '📌 THURSDAY' },
        { key: 'friday', title: '📌 FRIDAY' },
        { key: 'saturday', title: '📌 SATURDAY' },
        { key: 'sunday', title: '📌 SUNDAY' }
    ];
    
    days.forEach(day => {
        const dayData = this.weeklySchedule[day.key];
        if (dayData) {
            message += `*${day.title}*\n`;
            
            if (dayData.restDay) {
                message += `🛌 *REST DAY*\n`;
                if (dayData.focus) {
                    message += `_${dayData.focus}_\n`;
                }
            } else if (dayData.focus) {
                message += `💥 *Focus:* ${dayData.focus}\n\n`;
                
                // Warmup
                if (dayData.warmup) {
                    message += `🔥 *Warmup:* ${dayData.warmup}\n\n`;
                }
                
                // Exercises
                if (dayData.exercises && dayData.exercises.length > 0) {
                    message += `*Exercises:*\n`;
                    dayData.exercises.forEach((ex, idx) => {
                        message += `${idx + 1}. *${ex.name}*\n`;
                        message += `   Sets: ${ex.sets} | Reps: ${ex.reps}`;
                        if (ex.rest) message += ` | Rest: ${ex.rest}`;
                        message += `\n`;
                        if (ex.notes) message += `   _${ex.notes}_\n`;
                    });
                    message += `\n`;
                }
                
                // Cardio
                if (dayData.cardio) {
                    message += `🏃 *Cardio:* ${dayData.cardio}\n\n`;
                }
                
                // Cooldown
                if (dayData.cooldown) {
                    message += `🧘 *Cooldown:* ${dayData.cooldown}\n`;
                }
            }
            message += `\n`;
        }
    });
    
    // Important tips
    if (this.importantTips && this.importantTips.length > 0) {
        message += `💡 *IMPORTANT TIPS:*\n`;
        this.importantTips.forEach(tip => {
            message += `  ✓ ${tip}\n`;
        });
        message += `\n`;
    }
    
    // Safety guidelines
    if (this.safetyGuidelines && this.safetyGuidelines.length > 0) {
        message += `⚠️ *SAFETY FIRST:*\n`;
        this.safetyGuidelines.forEach(guideline => {
            message += `  • ${guideline}\n`;
        });
        message += `\n`;
    }
    
    // Recovery tips
    if (this.recoveryTips && this.recoveryTips.length > 0) {
        message += `🔄 *RECOVERY TIPS:*\n`;
        this.recoveryTips.forEach(tip => {
            message += `  • ${tip}\n`;
        });
        message += `\n`;
    }
    
    // General instructions
    if (this.generalInstructions) {
        message += `📝 *Important Notes:*\n${this.generalInstructions}\n\n`;
    }
    
    // Progression notes
    if (this.progressionNotes) {
        message += `📈 *Progression:*\n${this.progressionNotes}\n\n`;
    }
    
    message += `━━━━━━━━━━━━━━━━\n`;
    message += `💪 Stay consistent & crush your goals!\n`;
    message += `📞 Questions? Contact your trainer\n`;
    message += `\n_Sent from ${gymName}_`;
    
    return message;
};

// Method to get delivery statistics
workoutPlanSchema.methods.getDeliveryStats = function() {
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

module.exports = mongoose.model("WorkoutPlan", workoutPlanSchema);