const Owner = require("../../MemberCrud/Models/Owner");
const Member = require("../../MemberCrud/Models/Member");
const REMINDER_TEMPLATE_SID = "HXd89670d1e1a52f161cd36c8fed252e95";

const {
  sendWhatsapp,
  testTwilioSetup,
} = require("../../../../Utils/sendWhatsapp");
const { mailSender } = require("../../../../Utils/mailSender");
const { getGymName, getOwnerName } = require("../../../../Utils/gymContext");
const {
  getFeeReminderEmail,
} = require("../../../../Templates/memberCommunicationTemplates");

// FIXED: Add Member with proper limit checking and tracking + ENHANCED DEBUG LOGGING
exports.addMember = async (req, res, next) => {
  try {
    // ENHANCED DEBUG LOGGING
    console.log("=== ADD MEMBER DEBUG START ===");
    console.log("Full request body:", JSON.stringify(req.body, null, 2));
    console.log("Payment Method received:", req.body.paymentMethod);
    console.log("Emergency Contact received:", req.body.emergencyContact);
    console.log("Photo URL received:", req.body.photoUrl);
    console.log("================================");

    const userId = req.user.id;
    const {
      name,
      phoneNo,
      email,
      gender,
      age,
      joiningDate,
      planDuration,
      feesAmount,
      nextDueDate,
      paymentStatus,
      lastPaidOn,
      address,
      photoUrl,
      paymentMethod,
      emergencyContact,
    } = req.body;

    // DEBUG: Log extracted fields
    console.log("=== EXTRACTED FIELDS ===");
    console.log("paymentMethod:", paymentMethod);
    console.log("emergencyContact:", emergencyContact);
    console.log("photoUrl:", photoUrl);
    console.log("========================");

    // Get owner and check limits BEFORE creating member
    const owner = await Owner.findById(userId);
    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "Owner not found",
      });
    }

    // Check if subscription is active
    if (!owner.hasActiveSubscription()) {
      return res.status(403).json({
        success: false,
        message: "Active subscription required to add members",
        subscriptionRequired: true,
      });
    }

    // Sync actual member count with database
    const actualMemberCount = await Member.countDocuments({ ownerId: userId });
    if (owner.usageStats.membersCount !== actualMemberCount) {
      console.log(
        `Syncing member count before addition: ${owner.usageStats.membersCount} → ${actualMemberCount}`
      );
      owner.usageStats.membersCount = actualMemberCount;
      owner.usageStats.lastMemberCountUpdate = new Date();
      await owner.save();
    }

    // Check if user can add more members
    const planLimits = owner.getPlanLimits();
    if (
      planLimits.members !== -1 &&
      owner.usageStats.membersCount >= planLimits.members
    ) {
      return res.status(403).json({
        success: false,
        message: `Member limit reached (${owner.usageStats.membersCount}/${planLimits.members}). Please upgrade your plan to add more members.`,
        limitReached: true,
        currentCount: owner.usageStats.membersCount,
        limit: planLimits.members,
        needsUpgrade: true,
      });
    }

    // Check if member already exists
    const existingMember = await Member.findOne({
      phoneNo: phoneNo,
      ownerId: userId,
    });

    if (existingMember) {
      return res.status(409).json({
        success: false,
        message: "Member already exists in your gym",
      });
    }

    // Prepare member data with explicit field assignment
    const memberData = {
      ownerId: userId,
      name,
      phoneNo,
      email,
      gender,
      age,
      joiningDate,
      planDuration,
      feesAmount,
      nextDueDate,
      paymentStatus,
      lastPaidOn,
      address,
      photoUrl,
      paymentMethod: paymentMethod || "Cash", // Explicit fallback
      emergencyContact: emergencyContact || undefined, // Explicit assignment
    };

    // DEBUG: Log member data before creation
    console.log("=== MEMBER DATA BEFORE CREATION ===");
    console.log(JSON.stringify(memberData, null, 2));
    console.log("===================================");

    // Create the member
    const member = await Member.create(memberData);

    // DEBUG: Log created member
    console.log("=== CREATED MEMBER DATA ===");
    console.log("Name:", member.name);
    console.log("Payment Method:", member.paymentMethod);
    console.log("Emergency Contact:", member.emergencyContact);
    console.log("Photo URL:", member.photoUrl);
    console.log(
      "Full member object:",
      JSON.stringify(member.toObject(), null, 2)
    );
    console.log("===========================");

    // CRITICAL: Increment member count immediately after successful creation
    await owner.incrementMemberCount();
    console.log(
      `Member added successfully. Updated count: ${
        owner.usageStats.membersCount + 1
      }`
    );

    res.status(201).json({
      success: true,
      message: "New member added successfully",
      data: member,
      usage: {
        current: owner.usageStats.membersCount + 1,
        limit: planLimits.members === -1 ? "Unlimited" : planLimits.members,
      },
    });
  } catch (error) {
    console.error("=== ADD MEMBER ERROR ===");
    console.error("Error details:", error);
    console.error("Error stack:", error.stack);
    console.error("========================");

    res.status(500).json({
      success: false,
      message: "Unable to add member, please try again",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// SECURITY FIX: Get Member by Phone Number (owner-specific)
exports.getMemberByPhone = async (req, res) => {
  try {
    const { phoneNo } = req.params;

    // SECURITY FIX: Find member only within this owner's gym
    const member = await Member.findOne({
      phoneNo: phoneNo,
      ownerId: req.user.id,
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found in your gym",
      });
    }

    res.status(200).json({
      success: true,
      message: "Member fetched successfully",
      data: member,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch member, please try again",
    });
  }
};

// SECURITY FIX: Delete Member (owner-specific) - WITH COUNT TRACKING
exports.deleteMember = async (req, res) => {
  try {
    const { phoneNo } = req.params;
    const userId = req.user.id;

    // SECURITY FIX: Delete only from this owner's gym
    const deletedMember = await Member.findOneAndDelete({
      phoneNo: phoneNo,
      ownerId: userId,
    });

    if (!deletedMember) {
      return res.status(404).json({
        success: false,
        message: "Member not found in your gym",
      });
    }

    // CRITICAL: Decrement member count after deletion
    const owner = await Owner.findById(userId);
    if (owner) {
      await owner.decrementMemberCount();
      console.log(
        `Member deleted. Updated count: ${owner.usageStats.membersCount - 1}`
      );
    }

    res.status(200).json({
      success: true,
      message: "Deleted successfully",
      data: deletedMember,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Unable to delete member, please try again",
    });
  }
};

// SECURITY FIX: Get All Members (owner-specific)
exports.getAllMembers = async (req, res) => {
  try {
    // SECURITY FIX: Only fetch members belonging to this owner
    const members = await Member.find({
      ownerId: req.user.id,
    }).sort({ joiningDate: -1 });

    res.status(200).json({
      success: true,
      message: "Members fetched successfully",
      data: members,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch members, please try again",
    });
  }
};

// SECURITY FIX: Edit Member (owner-specific)
exports.editMember = async (req, res) => {
  try {
    const { phoneNo } = req.params;
    const updateData = req.body;

    // Remove empty or undefined fields from updateData
    const cleanUpdateData = {};
    Object.keys(updateData).forEach((key) => {
      if (
        updateData[key] !== undefined &&
        updateData[key] !== null &&
        updateData[key] !== ""
      ) {
        cleanUpdateData[key] = updateData[key];
      }
    });

    // SECURITY FIX: Update only within this owner's gym
    const updatedMember = await Member.findOneAndUpdate(
      {
        phoneNo: phoneNo,
        ownerId: req.user.id,
      },
      cleanUpdateData,
      { new: true, runValidators: true }
    );

    if (!updatedMember) {
      return res.status(404).json({
        success: false,
        message: "Member not found in your gym",
      });
    }

    res.status(200).json({
      success: true,
      message: "Member updated successfully",
      data: updatedMember,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Unable to update member, please try again",
    });
  }
};

// SECURITY FIX: Search Member (owner-specific)
exports.searchMember = async (req, res) => {
  try {
    const { query } = req.params;

    // Basic validation
    if (!query || query.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const searchTerm = query.trim();
    console.log("=== SEARCH DEBUG START ===");
    console.log("Raw query:", query);
    console.log("Trimmed search term:", searchTerm);
    console.log("Owner ID:", req.user.id);

    // Determine if it's a phone number or name
    const isPhoneNumber = /^\d+$/.test(searchTerm);
    console.log("Is phone number:", isPhoneNumber);

    let foundMember = null;

    // SECURITY FIX: Base query to include owner filter
    const baseQuery = { ownerId: req.user.id };

    if (isPhoneNumber) {
      // Phone number search - exact match within owner's gym
      console.log("Searching by phone number...");
      foundMember = await Member.findOne({
        ...baseQuery,
        phoneNo: searchTerm,
      });
      console.log(
        "Phone search result:",
        foundMember ? foundMember.name : "Not found"
      );
    } else {
      // Name search - multiple strategies within owner's gym
      console.log("Searching by name...");

      // Strategy 1: Exact case-insensitive match
      foundMember = await Member.findOne({
        ...baseQuery,
        name: new RegExp(`^${searchTerm}$`, "i"),
      });
      console.log(
        "Exact match result:",
        foundMember ? foundMember.name : "Not found"
      );

      // Strategy 2: If not found, try partial match from beginning
      if (!foundMember) {
        foundMember = await Member.findOne({
          ...baseQuery,
          name: new RegExp(`^${searchTerm}`, "i"),
        });
        console.log(
          "Starts with match result:",
          foundMember ? foundMember.name : "Not found"
        );
      }

      // Strategy 3: If still not found, try contains match
      if (!foundMember) {
        foundMember = await Member.findOne({
          ...baseQuery,
          name: new RegExp(searchTerm, "i"),
        });
        console.log(
          "Contains match result:",
          foundMember ? foundMember.name : "Not found"
        );
      }
    }

    console.log("=== SEARCH DEBUG END ===");

    // Return result
    if (!foundMember) {
      return res.status(404).json({
        success: false,
        message: isPhoneNumber
          ? `No member found with phone number: ${searchTerm} in your gym`
          : `No member found with name: ${searchTerm} in your gym`,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Member found successfully",
      data: foundMember,
    });
  } catch (error) {
    console.error("=== SEARCH ERROR ===");
    console.error("Error details:", error);
    console.error("Stack trace:", error.stack);

    return res.status(500).json({
      success: false,
      message: "Internal server error during search",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// SECURITY FIX: Get All Member Names (owner-specific)
exports.getAllMemberNames = async (req, res) => {
  try {
    // SECURITY FIX: Only get members for this owner
    const members = await Member.find(
      { ownerId: req.user.id },
      { name: 1, phoneNo: 1, _id: 0 }
    );

    return res.status(200).json({
      success: true,
      message: "All member names retrieved for your gym",
      data: members,
    });
  } catch (error) {
    console.error("Error getting member names:", error);
    return res.status(500).json({
      success: false,
      message: "Error retrieving member names",
    });
  }
};

// SECURITY FIX: Get All Due Members (owner-specific)
// exports.getAllDueMembers = async (req, res) => {
//   try {
//     console.log("getAllDueMembers controller HIT");
//     console.log("Authenticated user:", req.user?.email, "| Role:", req.user?.role);
//     console.log("Owner ID:", req.user?.id);

//     const currentDate = new Date();
//     currentDate.setHours(0, 0, 0, 0);
//     console.log("Current date for comparison:", currentDate.toISOString());

//     // SECURITY FIX: MongoDB query to find due members for THIS owner only
//     const query = {
//       ownerId: req.user.id, // Add owner filter
//       $and: [
//         {
//           $or: [
//             { nextDueDate: { $lte: currentDate } },
//             { paymentStatus: "Pending" }
//           ]
//         },
//         { nextDueDate: { $exists: true, $ne: null } }
//       ]
//     };

//     console.log("MongoDB query:", JSON.stringify(query, null, 2));

//     // Execute query
//     const dueMembers = await Member.find(query).sort({ nextDueDate: 1 });
//     console.log("Due members fetched from DB:", dueMembers.length);

//     if (dueMembers.length > 0) {
//       console.log("Sample member data:", {
//         name: dueMembers[0].name,
//         nextDueDate: dueMembers[0].nextDueDate,
//         paymentStatus: dueMembers[0].paymentStatus,
//         ownerId: dueMembers[0].ownerId
//       });
//     }

//     // Calculate overdue days and status for each member
//     const membersWithCalculations = dueMembers.map((member, index) => {
//       console.log(`Processing member ${index + 1}: ${member.name}`);

//       const memberObj = member.toObject();

//       if (member.nextDueDate) {
//         const memberDueDate = new Date(member.nextDueDate);
//         memberDueDate.setHours(0, 0, 0, 0);

//         const timeDiff = currentDate.getTime() - memberDueDate.getTime();
//         const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

//         memberObj.overdueDays = daysDiff > 0 ? daysDiff : 0;
//         memberObj.isDueToday = daysDiff === 0;
//         memberObj.isOverdue = daysDiff > 0;

//         console.log(`   ${member.name}: Due ${memberDueDate.toDateString()}, Days diff: ${daysDiff}, Status: ${memberObj.isOverdue ? 'Overdue' : memberObj.isDueToday ? 'Due Today' : 'Upcoming'}`);
//       } else {
//         memberObj.overdueDays = 0;
//         memberObj.isDueToday = false;
//         memberObj.isOverdue = false;
//         console.log(`   ${member.name}: No due date set`);
//       }

//       return memberObj;
//     });

//     // Calculate statistics
//     const statistics = {
//       total: membersWithCalculations.length,
//       overdue: membersWithCalculations.filter(m => m.isOverdue).length,
//       dueToday: membersWithCalculations.filter(m => m.isDueToday).length,
//       pending: membersWithCalculations.filter(m => m.paymentStatus === 'Pending').length
//     };

//     console.log("Final statistics:", statistics);

//     const response = {
//       success: true,
//       message: `Found ${membersWithCalculations.length} members with due fees in your gym`,
//       count: membersWithCalculations.length,
//       data: membersWithCalculations,
//       statistics
//     };

//     console.log("Sending successful response with", response.data.length, "members");
//     res.status(200).json(response);

//   } catch (error) {
//     console.error("Error in getAllDueMembers controller:", error.message);
//     console.error("Error stack:", error.stack);
//     console.error("Error details:", error);

//     res.status(500).json({
//       success: false,
//       message: "Unable to fetch due members, please try again",
//       error: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   }
// };

// UPDATED: Get All Due Members with Coming Due Logic (Next 4 Days)
// CRITICAL FIX: Get All Due Members with Coming Due Logic (Next 4 Days)
exports.getAllDueMembers = async (req, res) => {
  try {
    console.log("=====================================");
    console.log("getAllDueMembers controller HIT");
    console.log(
      "Authenticated user:",
      req.user?.email,
      "| Role:",
      req.user?.role
    );
    console.log("Owner ID:", req.user?.id);

    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    // Calculate date for 4 days from now
    const fourDaysFromNow = new Date(currentDate);
    fourDaysFromNow.setDate(currentDate.getDate() + 4);
    fourDaysFromNow.setHours(23, 59, 59, 999);

    console.log("Current date:", currentDate.toISOString());
    console.log("Four days from now:", fourDaysFromNow.toISOString());

    // Get members whose due date is within next 4 days OR have pending status
    const query = {
      ownerId: req.user.id,
      $and: [
        {
          $or: [
            // Members whose due date is within next 4 days (including today)
            {
              nextDueDate: {
                $lte: fourDaysFromNow,
              },
            },
            // OR members with pending payment status
            { paymentStatus: "Pending" },
          ],
        },
        { nextDueDate: { $exists: true, $ne: null } },
      ],
    };

    console.log("MongoDB query:", JSON.stringify(query, null, 2));

    // Execute query
    const dueMembers = await Member.find(query).sort({ nextDueDate: 1 });
    console.log("Due members fetched from DB:", dueMembers.length);

    if (dueMembers.length > 0) {
      console.log("Sample member:", {
        name: dueMembers[0].name,
        nextDueDate: dueMembers[0].nextDueDate,
        paymentStatus: dueMembers[0].paymentStatus,
      });
    }

    // Calculate status for each member
    const membersWithCalculations = dueMembers.map((member, index) => {
      const memberObj = member.toObject();

      if (member.nextDueDate) {
        const memberDueDate = new Date(member.nextDueDate);
        memberDueDate.setHours(0, 0, 0, 0);

        // Calculate difference in milliseconds, then convert to days
        const timeDiff = memberDueDate.getTime() - currentDate.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

        console.log(`Member ${index + 1}: ${member.name}`);
        console.log(`  Due Date: ${memberDueDate.toISOString()}`);
        console.log(`  Days Difference: ${daysDiff}`);

        // Determine member status
        if (daysDiff < 0) {
          // Overdue (past due date)
          memberObj.isOverdue = true;
          memberObj.isDueToday = false;
          memberObj.isComingDue = false;
          memberObj.overdueDays = Math.abs(daysDiff);
          memberObj.daysUntilDue = 0;
          console.log(`  Status: OVERDUE (${Math.abs(daysDiff)} days)`);
        } else if (daysDiff === 0) {
          // Due today
          memberObj.isOverdue = false;
          memberObj.isDueToday = true;
          memberObj.isComingDue = false;
          memberObj.overdueDays = 0;
          memberObj.daysUntilDue = 0;
          console.log(`  Status: DUE TODAY`);
        } else if (daysDiff >= 1 && daysDiff <= 4) {
          // Coming due (within next 1-4 days)
          memberObj.isOverdue = false;
          memberObj.isDueToday = false;
          memberObj.isComingDue = true;
          memberObj.overdueDays = 0;
          memberObj.daysUntilDue = daysDiff;
          console.log(`  Status: COMING DUE (in ${daysDiff} days)`);
        } else {
          // Future due (more than 4 days away)
          memberObj.isOverdue = false;
          memberObj.isDueToday = false;
          memberObj.isComingDue = false;
          memberObj.overdueDays = 0;
          memberObj.daysUntilDue = daysDiff;
          console.log(`  Status: FUTURE (in ${daysDiff} days)`);
        }
      } else {
        memberObj.overdueDays = 0;
        memberObj.isDueToday = false;
        memberObj.isOverdue = false;
        memberObj.isComingDue = false;
        memberObj.daysUntilDue = 0;
        console.log(`  Status: NO DUE DATE`);
      }

      return memberObj;
    });

    // Calculate statistics
    const statistics = {
      total: membersWithCalculations.length,
      comingDue: membersWithCalculations.filter((m) => m.isComingDue === true)
        .length,
      dueToday: membersWithCalculations.filter((m) => m.isDueToday === true)
        .length,
      pending: membersWithCalculations.filter(
        (m) => m.isOverdue === true || m.paymentStatus === "Pending"
      ).length,
    };

    console.log("=====================================");
    console.log("FINAL STATISTICS:");
    console.log("  Total:", statistics.total);
    console.log("  Coming Due:", statistics.comingDue);
    console.log("  Due Today:", statistics.dueToday);
    console.log("  Pending/Overdue:", statistics.pending);
    console.log("=====================================");

    const response = {
      success: true,
      message: `Found ${membersWithCalculations.length} members with due fees`,
      count: membersWithCalculations.length,
      data: membersWithCalculations,
      statistics,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("=====================================");
    console.error("ERROR in getAllDueMembers:");
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);
    console.error("=====================================");

    res.status(500).json({
      success: false,
      message: "Unable to fetch due members, please try again",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// SECURITY FIX: Send Member Reminder (owner-specific) with WhatsApp Usage Tracking
exports.sendMemberReminder = async (req, res) => {
  try {
    const { memberId } = req.params;

    console.log(`Sending reminder to member ID: ${memberId}`);

    // Check WhatsApp availability, but don't block email if unavailable
    const twilioTest = await testTwilioSetup();
    const whatsappAvailable = twilioTest.success;

    // SECURITY FIX: Find the member only within this owner's gym
    const member = await Member.findOne({
      _id: memberId,
      ownerId: req.user.id,
    });

    if (!member) {
      console.log(`Member not found with ID: ${memberId} in your gym`);
      return res.status(404).json({
        success: false,
        message: "Member not found in your gym",
      });
    }

    // Check if member has at least one communication channel
    if (!member.phoneNo && !member.email) {
      console.log(`Member ${member.name} has no phone number and no email`);
      return res.status(400).json({
        success: false,
        message: "Member has no phone number or email",
      });
    }

    // Calculate overdue days if applicable
    const today = new Date();
    const dueDate = new Date(member.nextDueDate);
    const timeDiff = today.getTime() - dueDate.getTime();
    const overdueDays = Math.max(
      0,
      Math.ceil(timeDiff / (1000 * 60 * 60 * 24))
    );

    // Create reminder message
    let message;
    if (overdueDays > 0) {
      message = `Hi ${member.name}, your gym fees of ₹${
        member.feesAmount || "pending amount"
      } is overdue by ${overdueDays} days. Please make the payment at your earliest convenience. Thank you!`;
    } else {
      message = `Hi ${member.name}, your gym fees of ₹${
        member.feesAmount || "pending amount"
      } is due today. Please make the payment. Thank you!`;
    }

    const owner = await Owner.findById(req.user.id);
    const gymName = getGymName(owner);
    const ownerName = getOwnerName(owner);

<<<<<<< HEAD
    let whatsappStatus = "skipped";
    let whatsappSid = null;
    let emailStatus = "skipped";
    let emailMessageId = null;
    const channelErrors = [];
=======
    try {
  const result = await sendWhatsapp(
    member.phoneNo,
    REMINDER_TEMPLATE_SID,   // ✅ TEMPLATE SID
    {
      "1": member.name,                 // {{1}}
      "2": `₹${member.feesAmount}`       // {{2}}
    }
  );

>>>>>>> 97ec0cea5d908d7a638cdcb1bd9e5d0d7be586f8

    if (member.phoneNo && whatsappAvailable) {
      try {
        const result = await sendWhatsapp(member.phoneNo, message);
        whatsappStatus = "sent";
        whatsappSid = result.sid;

        if (owner) {
          await owner.trackFeatureUsage("whatsappReminders");
        }
      } catch (whatsappError) {
        whatsappStatus = "failed";
        channelErrors.push(`WhatsApp: ${whatsappError.message}`);
      }
    } else if (member.phoneNo && !whatsappAvailable) {
      whatsappStatus = "failed";
      channelErrors.push("WhatsApp: service unavailable");
    }

    if (member.email) {
      try {
        const emailHtml = getFeeReminderEmail({
          memberName: member.name || "Member",
          gymName,
          ownerName,
          amount: member.feesAmount,
          dueDate: member.nextDueDate,
          overdueDays,
        });
        const info = await mailSender(
          member.email,
          `[${gymName}] Fee Reminder - ${member.name}`,
          emailHtml
        );
        emailStatus = "sent";
        emailMessageId = info?.messageId || null;
      } catch (emailError) {
        emailStatus = "failed";
        channelErrors.push(`Email: ${emailError.message}`);
      }
    }

    if (whatsappStatus !== "sent" && emailStatus !== "sent") {
      return res.status(502).json({
        success: false,
        message: "Failed to deliver reminder on both WhatsApp and Email",
        error: channelErrors.join(" | "),
      });
    }

    // Update member record with reminder sent timestamp
    await Member.findOneAndUpdate(
      { _id: memberId, ownerId: req.user.id },
      { lastReminderSent: new Date() }
    );

    res.json({
      success: true,
      message: "Reminder sent successfully via WhatsApp and/or Email",
      data: {
        memberId: member._id,
        memberName: member.name,
        phoneNo: member.phoneNo || null,
        email: member.email || null,
        sentAt: new Date(),
        whatsapp: {
          status: whatsappStatus,
          sid: whatsappSid,
        },
        emailDelivery: {
          status: emailStatus,
          messageId: emailMessageId,
        },
      },
    });
  } catch (error) {
    console.error("Error in sendMemberReminder:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send reminder",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// SECURITY FIX: Get detailed member information (owner-specific)
exports.getMemberDetails = async (req, res) => {
  try {
    const { memberId } = req.params;

    console.log(`Fetching member details for ID: ${memberId}`);

    // SECURITY FIX: Find the member with all details only within this owner's gym
    const member = await Member.findOne({
      _id: memberId,
      ownerId: req.user.id,
    });

    if (!member) {
      console.log(`Member not found with ID: ${memberId} in your gym`);
      return res.status(404).json({
        success: false,
        message: "Member not found in your gym",
      });
    }

    // Calculate additional fields
    const today = new Date();
    const dueDate = new Date(member.nextDueDate);
    const timeDiff = today.getTime() - dueDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    const overdueDays = Math.max(0, daysDiff);
    const isDueToday = daysDiff === 0;
    const isOverdue = daysDiff > 0;

    // Enhanced member data
    const memberData = {
      ...member.toObject(),
      isOverdue,
      isDueToday,
      overdueDays: isOverdue ? overdueDays : 0,
      daysUntilDue: isDueToday ? 0 : Math.abs(daysDiff),
      membershipDuration: member.joiningDate
        ? Math.floor(
            (today - new Date(member.joiningDate)) / (1000 * 60 * 60 * 24)
          )
        : 0,
      memberId: member._id.toString().slice(-6),
      joinDate: member.joiningDate, // Add alias for frontend compatibility
    };

    console.log(`Member details fetched successfully: ${member.name}`);

    res.json({
      success: true,
      message: "Member details fetched successfully",
      data: memberData,
    });
  } catch (error) {
    console.error("Error fetching member details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch member details",
      error: error.message,
    });
  }
};

// SECURITY FIX: Send All Member Reminders (bulk) with WhatsApp Usage Tracking
exports.sendAllMemberReminders = async (req, res) => {
  try {
    const ownerId = req.user.id;

    console.log(`Starting bulk reminder sending process for owner: ${ownerId}`);

    const twilioTest = await testTwilioSetup();
    const whatsappAvailable = twilioTest.success;
    if (!whatsappAvailable) {
      console.warn("Twilio setup test failed, continuing with email flow only.");
    }

    // Get today's date for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // SECURITY FIX: Find due members only for this owner
    const dueMembers = await Member.find({
      ownerId: ownerId,
      nextDueDate: { $lte: today },
      $or: [
        { phoneNo: { $exists: true, $ne: "" } },
        { email: { $exists: true, $ne: "" } },
      ],
    });

    if (dueMembers.length === 0) {
      console.log(`No due members found with phone number/email in your gym`);
      return res.status(200).json({
        success: true,
        message: "No due members found with phone number/email",
        data: {
          total: 0,
          totalMembers: 0,
          successful: 0,
          failed: 0,
          whatsapp: {
            sent: 0,
            failed: 0,
            skipped: 0,
          },
          email: {
            sent: 0,
            failed: 0,
            skipped: 0,
          },
          members: [],
        },
      });
    }

    console.log(
      `Found ${dueMembers.length} due members with phone number/email in your gym`
    );

    const results = [];
    let successCount = 0;
    let failureCount = 0;
    let whatsappSuccess = 0;
    let whatsappFailed = 0;
    let whatsappSkipped = 0;
    let emailSuccess = 0;
    let emailFailed = 0;
    let emailSkipped = 0;
    let totalWhatsAppTracked = 0;

    const owner = await Owner.findById(ownerId);
    const gymName = getGymName(owner);
    const ownerName = getOwnerName(owner);

    // Send reminders to all due members
    for (const member of dueMembers) {
      try {
        // Calculate overdue days
        const memberDueDate = new Date(member.nextDueDate);
        memberDueDate.setHours(0, 0, 0, 0);

        const timeDiff = today.getTime() - memberDueDate.getTime();
        const overdueDays = Math.max(
          0,
          Math.ceil(timeDiff / (1000 * 60 * 60 * 24))
        );

        // Create personalized message
        let message;
        if (overdueDays > 0) {
          message = `Hi ${member.name}, your gym fees of ₹${
            member.feesAmount || "pending amount"
          } is overdue by ${overdueDays} days. Please make the payment at your earliest convenience. Thank you!`;
        } else {
          message = `Hi ${member.name}, your gym fees of ₹${
            member.feesAmount || "pending amount"
          } is due today. Please make the payment. Thank you!`;
        }

        console.log(`Sending reminder to: ${member.name}`);

        let whatsappStatus = "skipped";
        let whatsappSid = null;
        let emailStatus = "skipped";
        let emailMessageId = null;
        const channelErrors = [];

        if (member.phoneNo && whatsappAvailable) {
          try {
            const result = await sendWhatsapp(member.phoneNo, message);
            whatsappStatus = "success";
            whatsappSid = result.sid;
            whatsappSuccess++;
            totalWhatsAppTracked++;
          } catch (whatsappError) {
            whatsappStatus = "failed";
            whatsappFailed++;
            channelErrors.push(`WhatsApp: ${whatsappError.message}`);
          }
        } else if (member.phoneNo && !whatsappAvailable) {
          whatsappStatus = "failed";
          whatsappFailed++;
          channelErrors.push("WhatsApp: service unavailable");
        } else {
          whatsappSkipped++;
        }

        if (member.email) {
          try {
            const emailHtml = getFeeReminderEmail({
              memberName: member.name || "Member",
              gymName,
              ownerName,
              amount: member.feesAmount,
              dueDate: member.nextDueDate,
              overdueDays,
            });
            const info = await mailSender(
              member.email,
              `[${gymName}] Fee Reminder - ${member.name}`,
              emailHtml
            );
            emailStatus = "success";
            emailMessageId = info?.messageId || null;
            emailSuccess++;
          } catch (emailError) {
            emailStatus = "failed";
            emailFailed++;
            channelErrors.push(`Email: ${emailError.message}`);
          }
        } else {
          emailSkipped++;
        }

        // Update member with last reminder sent timestamp
        await Member.findByIdAndUpdate(member._id, {
          lastReminderSent: new Date(),
        });

        const isDelivered =
          whatsappStatus === "success" || emailStatus === "success";

        results.push({
          memberId: member._id,
          memberName: member.name,
          phoneNo: member.phoneNo || null,
          email: member.email || null,
          status: isDelivered ? "success" : "failed",
          whatsapp: {
            status: whatsappStatus,
            sid: whatsappSid,
          },
          emailDelivery: {
            status: emailStatus,
            messageId: emailMessageId,
          },
          error: channelErrors.length ? channelErrors.join(" | ") : null,
          sentAt: new Date(),
        });

        if (isDelivered) {
          successCount++;
        } else {
          failureCount++;
        }
      } catch (error) {
        console.error(`Failed to send reminder to ${member.name}:`, error);

        results.push({
          memberId: member._id,
          memberName: member.name,
          phoneNo: member.phoneNo || null,
          email: member.email || null,
          status: "failed",
          error: error.message,
          sentAt: new Date(),
        });

        failureCount++;
      }
    }

    // Track successful WhatsApp reminders only
    if (totalWhatsAppTracked > 0 && owner) {
      try {
        for (let i = 0; i < totalWhatsAppTracked; i++) {
          await owner.trackFeatureUsage("whatsappReminders");
        }
      } catch (usageError) {
        console.error("Failed to track WhatsApp usage:", usageError);
      }
    }

    // Send summary to owner
    try {
      const ownerPhone = req.user.mobileNumber;
      if (ownerPhone && whatsappAvailable) {
        const summaryMessage = `Bulk reminders sent: ${successCount} successful, ${failureCount} failed out of ${dueMembers.length} due members.`;

        console.log(`Sending summary to owner: ${ownerPhone}`);
        await sendWhatsapp(ownerPhone, summaryMessage);
        console.log(`Summary sent to owner`);

        // Track owner summary message as well
        if (owner) {
          await owner.trackFeatureUsage("whatsappReminders");
          console.log(`Tracked owner summary message`);
          totalWhatsAppTracked += 1;
        }
      }
    } catch (summaryError) {
      console.error("Failed to send summary to owner:", summaryError);
      // Don't fail the entire operation if summary fails
    }

    console.log(
      `Bulk reminder process completed - Success: ${successCount}, Failed: ${failureCount}`
    );

    res.status(200).json({
      success: true,
      message: `Bulk reminders sent successfully`,
      data: {
        total: dueMembers.length,
        totalMembers: dueMembers.length,
        successful: successCount,
        failed: failureCount,
        usageTracked: totalWhatsAppTracked,
        whatsapp: {
          sent: whatsappSuccess,
          failed: whatsappFailed,
          skipped: whatsappSkipped,
        },
        email: {
          sent: emailSuccess,
          failed: emailFailed,
          skipped: emailSkipped,
        },
        members: results,
      },
    });
  } catch (error) {
    console.error("Error in sendAllMemberReminders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send bulk reminders",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// SECURITY FIX: Mark Member Fee Paid (owner-specific)
exports.markMemberFeePaid = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { paidDate, paymentMethod = "Cash", notes } = req.body;

    console.log(`Marking member as paid - ID: ${memberId}`);

    // SECURITY FIX: Find the member only within this owner's gym
    const member = await Member.findOne({
      _id: memberId,
      ownerId: req.user.id,
    });

    if (!member) {
      console.log(`Member not found with ID: ${memberId} in your gym`);
      return res.status(404).json({
        success: false,
        message: "Member not found in your gym",
      });
    }

    // Calculate next due date based on plan duration
    const lastPaidDate = paidDate ? new Date(paidDate) : new Date();
    let nextDueDate = new Date(lastPaidDate);

    // Add duration based on plan (adjust logic as per your plan structure)
    const planDurationMap = {
      "1 month": 30,
      "3 months": 90,
      "6 months": 180,
      "1 year": 365,
      // Add more variations as needed
      "1 Month": 30,
      "3 Months": 90,
      "6 Months": 180,
      "12 Months": 365,
      "1 year": 365,
      "12 months": 365,
    };

    const daysToAdd = planDurationMap[member.planDuration] || 30; // Default to 30 days
    nextDueDate.setDate(nextDueDate.getDate() + daysToAdd);

    console.log(
      `Updating payment - Last paid: ${lastPaidDate.toISOString()}, Next due: ${nextDueDate.toISOString()}`
    );

    // SECURITY FIX: Update member record only within this owner's gym
    const updatedMember = await Member.findOneAndUpdate(
      { _id: memberId, ownerId: req.user.id },
      {
        lastPaidOn: lastPaidDate,
        nextDueDate: nextDueDate,
        paymentStatus: "Paid",
        paymentMethod: paymentMethod,
        paymentNotes: notes,
        updatedAt: new Date(),
      },
      {
        new: true,
        runValidators: true,
      }
    );

    // Optional: Send confirmation WhatsApp to member
    if (member.phoneNo) {
      const confirmationMessage = `Hi ${
        member.name
      }, we have received your payment of ₹${
        member.feesAmount
      }. Your next due date is ${nextDueDate.toLocaleDateString(
        "en-IN"
      )}. Thank you!`;
      try {
        await sendWhatsapp(member.phoneNo, confirmationMessage);
        console.log(`Payment confirmation sent to member: ${member.name}`);
      } catch (whatsappError) {
        console.error("Error sending confirmation WhatsApp:", whatsappError);
        // Don't fail the main operation if WhatsApp fails
      }
    }

    // Optional: Send notification to owner/admin
    if (process.env.OWNER_PHONE) {
      const ownerMessage = `Payment received from ${member.name} (${member._id
        .toString()
        .slice(-6)}) - Amount: ₹${
        member.feesAmount
      }. Next due: ${nextDueDate.toLocaleDateString("en-IN")}`;
      try {
        await sendWhatsapp(process.env.OWNER_PHONE, ownerMessage);
        console.log(`Owner payment notification sent`);
      } catch (whatsappError) {
        console.error("Error sending owner notification:", whatsappError);
      }
    }

    console.log(`Member payment updated successfully: ${member.name}`);

    res.json({
      success: true,
      message: "Member payment updated successfully",
      data: {
        memberId: updatedMember._id,
        memberName: updatedMember.name,
        lastPaidOn: updatedMember.lastPaidOn,
        nextDueDate: updatedMember.nextDueDate,
        paymentStatus: updatedMember.paymentStatus,
        amount: updatedMember.feesAmount,
      },
    });
  } catch (error) {
    console.error("Error marking member as paid:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update payment status",
      error: error.message,
    });
  }
};

// Delete Member by ID (owner-specific) - WITH COUNT TRACKING
exports.deleteMemberById = async (req, res) => {
  try {
    const { memberId } = req.params;
    const userId = req.user.id;

    // SECURITY FIX: Delete only from this owner's gym
    const deletedMember = await Member.findOneAndDelete({
      _id: memberId,
      ownerId: userId,
    });

    if (!deletedMember) {
      return res.status(404).json({
        success: false,
        message: "Member not found in your gym",
      });
    }

    // CRITICAL: Decrement member count after deletion
    const owner = await Owner.findById(userId);
    if (owner) {
      await owner.decrementMemberCount();
      console.log(
        `Member deleted by ID. Updated count: ${
          owner.usageStats.membersCount - 1
        }`
      );
    }

    res.status(200).json({
      success: true,
      message: "Member deleted successfully",
      data: deletedMember,
    });
  } catch (error) {
    console.error("Error deleting member by ID:", error);
    res.status(500).json({
      success: false,
      message: "Unable to delete member, please try again",
    });
  }
};

// Get member stats for dashboard
exports.getMemberStats = async (req, res) => {
  try {
    const ownerId = req.user.id;

    // Get all members for this owner
    const allMembers = await Member.find({ ownerId: ownerId });

    // Calculate current date for comparisons
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate statistics
    const stats = {
      totalMembers: allMembers.length,
      activeMembers: allMembers.filter((member) => {
        const dueDate = new Date(member.nextDueDate);
        return member.paymentStatus === "Paid" && dueDate > today;
      }).length,
      dueToday: allMembers.filter((member) => {
        const dueDate = new Date(member.nextDueDate);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate.getTime() === today.getTime();
      }).length,
      overdue: allMembers.filter((member) => {
        const dueDate = new Date(member.nextDueDate);
        return dueDate < today || member.paymentStatus === "Pending";
      }).length,
      thisMonthJoined: allMembers.filter((member) => {
        const joinDate = new Date(member.joiningDate);
        return (
          joinDate.getMonth() === today.getMonth() &&
          joinDate.getFullYear() === today.getFullYear()
        );
      }).length,
      monthlyRevenue: allMembers.reduce((total, member) => {
        return total + (parseFloat(member.feesAmount) || 0);
      }, 0),
    };

    res.json({
      success: true,
      message: "Member statistics retrieved successfully",
      data: stats,
    });
  } catch (error) {
    console.error("Error getting member stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve member statistics",
      error: error.message,
    });
  }
};

// Bulk operations
exports.bulkUpdateMembers = async (req, res) => {
  try {
    const { memberIds, updateData } = req.body;
    const ownerId = req.user.id;

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Member IDs array is required",
      });
    }

    // Update members only belonging to this owner
    const result = await Member.updateMany(
      {
        _id: { $in: memberIds },
        ownerId: ownerId,
      },
      {
        ...updateData,
        updatedAt: new Date(),
      }
    );

    res.json({
      success: true,
      message: `Successfully updated ${result.modifiedCount} members`,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Error in bulk update:", error);
    res.status(500).json({
      success: false,
      message: "Failed to perform bulk update",
      error: error.message,
    });
  }
};

// Export all functions
module.exports = {
  addMember: exports.addMember,
  getMemberByPhone: exports.getMemberByPhone,
  deleteMember: exports.deleteMember,
  deleteMemberById: exports.deleteMemberById,
  getAllMembers: exports.getAllMembers,
  editMember: exports.editMember,
  searchMember: exports.searchMember,
  getAllMemberNames: exports.getAllMemberNames,
  getAllDueMembers: exports.getAllDueMembers,
  sendMemberReminder: exports.sendMemberReminder,
  getMemberDetails: exports.getMemberDetails,
  sendAllMemberReminders: exports.sendAllMemberReminders,
  markMemberFeePaid: exports.markMemberFeePaid,
  getMemberStats: exports.getMemberStats,
  bulkUpdateMembers: exports.bulkUpdateMembers,

  // Aliases for consistency
  markMemberAsPaid: exports.markMemberFeePaid,
  sendAllReminders: exports.sendAllMemberReminders,
};
