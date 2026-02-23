const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema({
    // Owner reference
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Owner',
        required: true,
        index: true
    },
    
    // Announcement content
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    
    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1500
    },
    
    // Announcement type
    announcementType: {
        type: String,
        enum: ['General', 'Holiday', 'Event', 'Maintenance', 'Fees Reminder', 'New Class', 'Emergency', 'Other'],
        default: 'General'
    },
    
    // Priority level
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Urgent'],
        default: 'Medium'
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
        sentAt: {
            type: Date
        }
    },
    
    // Delivery log
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
    
    // Filters used for sending
    filters: {
        gender: {
            type: String,
            enum: ['All', 'Male', 'Female'],
            default: 'All'
        },
        paymentStatus: {
            type: String,
            enum: ['All', 'Paid', 'Pending'],
            default: 'All'
        }
    },
    
    // Status
    status: {
        type: String,
        enum: ['Draft', 'Sent'],
        default: 'Draft'
    }
    
}, {
    timestamps: true
});

// Indexes
announcementSchema.index({ ownerId: 1, createdAt: -1 });
announcementSchema.index({ ownerId: 1, status: 1 });

// Method to log delivery
announcementSchema.methods.logDelivery = function(member, status, errorMessage = null, twilioSid = null) {
    this.deliveryLog.push({
        memberId: member._id,
        memberName: member.name,
        memberPhone: member.phoneNo,
        sentAt: new Date(),
        status: status,
        errorMessage: errorMessage,
        twilioMessageSid: twilioSid
    });
    
    this.broadcastDetails.totalMembersSent += 1;
    if (status === 'sent' || status === 'delivered') {
        this.broadcastDetails.successfulDeliveries += 1;
    } else {
        this.broadcastDetails.failedDeliveries += 1;
    }
    
    return this.save();
};

// Method to format WhatsApp message
announcementSchema.methods.getWhatsAppMessage = function(memberName = null, gymName = "Your Gym") {
    let message = `━━━━━━━━━━━━━━━━\n`;
    message += `📢 *ANNOUNCEMENT*\n`;
    message += `━━━━━━━━━━━━━━━━\n\n`;
    
    if (memberName) {
        message += `👤 Hello *${memberName}*,\n\n`;
    }
    
    // Priority indicator
    if (this.priority === 'Urgent' || this.priority === 'High') {
        message += `⚠️ *${this.priority.toUpperCase()} MESSAGE*\n\n`;
    }
    
    // Title
    message += `📌 *${this.title}*\n\n`;
    
    // Message content
    message += `${this.message}\n\n`;
    
    message += `━━━━━━━━━━━━━━━━\n`;
    message += `🏋️ ${gymName}\n`;
    
    const date = new Date().toLocaleDateString('en-IN', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
    });
    message += `📅 ${date}`;
    
    return message;
};

// Method to get delivery stats
announcementSchema.methods.getDeliveryStats = function() {
    return {
        totalSent: this.broadcastDetails.totalMembersSent,
        successful: this.broadcastDetails.successfulDeliveries,
        failed: this.broadcastDetails.failedDeliveries,
        successRate: this.broadcastDetails.totalMembersSent > 0 
            ? ((this.broadcastDetails.successfulDeliveries / this.broadcastDetails.totalMembersSent) * 100).toFixed(2) 
            : 0,
        sentAt: this.broadcastDetails.sentAt
    };
};

module.exports = mongoose.model("Announcement", announcementSchema);
