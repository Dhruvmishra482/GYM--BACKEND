const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema({
    // SECURITY FIX: Add owner reference to isolate data
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Owner',
        required: true,
        index: true // Add index for performance
    },
    name: {
        type: String,
        required: true
    },
    phoneNo: {
        type: String,
        required: true,
        // SECURITY FIX: Phone number should be unique per owner, not globally
        // We'll handle this in application logic instead of schema
    },
    age: {
        type: Number,
    },
    gender: {
        type: String,
        enum: ["Male","Female","Others"]
    },
    email: {
        type: String,
        lowercase: true
    },
    joiningDate: {
        type: Date,
        default: Date.now
    },
    planDuration: {
        type: String,
        enum: ["1 month","3 month","6 month","1 year"]
    },
    feesAmount: {
        type: Number,
        required: true,
    },
    nextDueDate: {
        type: Date,
        // required: true
    },
  paymentStatus: {
  type: String,
  enum: ["Paid","Pending","Overdue"],  // Add "Overdue"
  default: "Pending"
},
    lastPaidOn: {
        type: Date
    },
    address: {
        type: String,
        required: true
    },
    
    // Additional fields for reminder functionality
    lastReminderSent: {
        type: Date
    },
    paymentMethod: {
        type: String,
        enum: ["Cash","Card","UPI","Bank Transfer","Other"],
        default: "Cash"
    },
    paymentNotes: {
        type: String
    },
    // Photo URL field
    photoUrl: {
        type: String,
        default: null
    },
    // Emergency contact field
    emergencyContact: {
        type: String,
        required: false
    }
},{
    timestamps: true
});

// SECURITY FIX: Compound index for owner-specific phone uniqueness
memberSchema.index({ ownerId: 1, phoneNo: 1 }, { unique: true });

// Add indexes for better query performance
memberSchema.index({ ownerId: 1, nextDueDate: 1 });
memberSchema.index({ ownerId: 1, paymentStatus: 1 });
memberSchema.index({ ownerId: 1, phoneNo: 1 });

// Virtual field to get member ID (last 6 characters of _id)
memberSchema.virtual('memberId').get(function () {
    return this._id.toString().slice(-6);
});

// Ensure virtual fields are serialized
memberSchema.set('toJSON', { virtuals: true });
memberSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model("Member", memberSchema);