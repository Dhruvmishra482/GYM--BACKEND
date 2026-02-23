const Announcement = require("../models/announcementSchema");
const Member = require("../../../../Basic/Features/MemberCrud/Models/Member");
const Owner = require("../../../../Basic/Features/MemberCrud/Models/Owner");
const { sendWhatsapp } = require("../../../../Utils/sendWhatsapp");
const { mailSender } = require("../../../../Utils/mailSender");
const { getGymName, getOwnerName } = require("../../../../Utils/gymContext");
const {
  getAnnouncementEmail,
} = require("../../../../Templates/memberCommunicationTemplates");

const ALLOWED_ANNOUNCEMENT_TYPES = [
  "General",
  "Holiday",
  "Event",
  "Maintenance",
  "Fees Reminder",
  "New Class",
  "Emergency",
  "Other",
];

const normalizeAnnouncementType = (value) => {
  if (!value) return "General";
  const normalized = String(value).trim().toLowerCase();
  const match = ALLOWED_ANNOUNCEMENT_TYPES.find(
    (type) => type.toLowerCase() === normalized
  );
  return match || "General";
};

// Create and send announcement immediately
exports.sendAnnouncement = async (req, res) => {
  try {
    const ownerId = req.user.id;

    const {
      title,
      message,
      announcementType,
      priority,
      filterGender,
      filterPaymentStatus,
    } = req.body;
    const normalizedAnnouncementType = normalizeAnnouncementType(announcementType);

    // Validate required fields
    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: "Title and message are required",
      });
    }

    // Get owner details
    const owner = await Owner.findById(ownerId);
    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "Owner not found",
      });
    }

    // Create announcement
    const announcement = await Announcement.create({
      ownerId,
      title,
      message,
      announcementType: normalizedAnnouncementType,
      priority: priority || "Medium",
      filters: {
        gender: filterGender || "All",
        paymentStatus: filterPaymentStatus || "All",
      },
      status: "Draft",
    });

    // Build member query
    const memberQuery = { ownerId };

    if (filterGender && filterGender !== "All") {
      memberQuery.gender = filterGender;
    }

    if (filterPaymentStatus && filterPaymentStatus !== "All") {
      memberQuery.paymentStatus = filterPaymentStatus;
    }

    // Get all members
    const members = await Member.find(memberQuery);

    if (members.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No members found to send announcement",
      });
    }

    // Track feature usage for bulk communication
    await owner.trackFeatureUsage("whatsappReminders");

    // Send to all members
    let successCount = 0;
    let failedCount = 0;
    let whatsappSuccess = 0;
    let whatsappFailed = 0;
    let whatsappSkipped = 0;
    let emailSuccess = 0;
    let emailFailed = 0;
    let emailSkipped = 0;
    const deliveryResults = [];

    const gymName = getGymName(owner);
    const ownerName = getOwnerName(owner);

    for (const member of members) {
      const channelErrors = [];
      let whatsappStatus = "skipped";
      let emailStatus = "skipped";
      let whatsappSid = null;
      let emailMessageId = null;

      try {
        // Personalized WhatsApp message
        const whatsappMessage = announcement.getWhatsAppMessage(
          member.name,
          gymName
        );

        // Send WhatsApp if phone exists
        if (member.phoneNo) {
          try {
            const result = await sendWhatsapp(member.phoneNo, whatsappMessage);
            whatsappStatus = "sent";
            whatsappSid = result.sid;
            whatsappSuccess++;
          } catch (error) {
            whatsappStatus = "failed";
            whatsappFailed++;
            channelErrors.push(`WhatsApp: ${error.message}`);
          }
        } else {
          whatsappSkipped++;
        }

        // Send email if email exists
        if (member.email) {
          try {
            const emailHtml = getAnnouncementEmail({
              memberName: member.name || "Member",
              gymName,
              ownerName,
              title,
              message,
              priority: priority || "Medium",
              announcementType: normalizedAnnouncementType,
            });
            const info = await mailSender(
              member.email,
              `[${gymName}] ${title}`,
              emailHtml
            );
            emailStatus = "sent";
            emailMessageId = info?.messageId || null;
            emailSuccess++;
          } catch (error) {
            emailStatus = "failed";
            emailFailed++;
            channelErrors.push(`Email: ${error.message}`);
          }
        } else {
          emailSkipped++;
        }

        const isDelivered = whatsappStatus === "sent" || emailStatus === "sent";
        if (isDelivered) {
          await announcement.logDelivery(member, "sent", null, whatsappSid);
          successCount++;
        } else {
          await announcement.logDelivery(
            member,
            "failed",
            channelErrors.join(" | ") || "No valid delivery channel"
          );
          failedCount++;
        }

        deliveryResults.push({
          memberId: member._id,
          name: member.name,
          phone: member.phoneNo || null,
          email: member.email || null,
          status: isDelivered ? "sent" : "failed",
          whatsapp: {
            status: whatsappStatus,
            messageSid: whatsappSid,
          },
          emailDelivery: {
            status: emailStatus,
            messageId: emailMessageId,
          },
          error: channelErrors.length ? channelErrors.join(" | ") : null,
        });

        // Small delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        failedCount++;
        await announcement.logDelivery(
          member,
          "failed",
          error.message || "Failed to send announcement"
        );
        deliveryResults.push({
          memberId: member._id,
          name: member.name,
          phone: member.phoneNo || null,
          email: member.email || null,
          status: "failed",
          error: error.message,
        });
        console.error(`Failed to process ${member.name}:`, error.message);
      }
    }

    // Update announcement status and sent time
    announcement.status = "Sent";
    announcement.broadcastDetails.sentAt = new Date();
    await announcement.save();

    return res.status(200).json({
      success: true,
      message: "Announcement sent successfully",
      data: {
        announcementId: announcement._id,
        title: announcement.title,
        totalMembers: members.length,
        successfulDeliveries: successCount,
        failedDeliveries: failedCount,
        successRate: ((successCount / members.length) * 100).toFixed(2) + "%",
        channelStats: {
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
        },
        deliveryDetails: deliveryResults,
      },
    });
  } catch (error) {
    console.error("Error sending announcement:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send announcement",
      error: error.message,
    });
  }
};

// Get all announcements for owner
exports.getAllAnnouncements = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    const announcements = await Announcement.find({ ownerId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Announcement.countDocuments({ ownerId });

    return res.status(200).json({
      success: true,
      data: announcements,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching announcements:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch announcements",
      error: error.message,
    });
  }
};

// Get single announcement by ID
exports.getAnnouncementById = async (req, res) => {
  try {
    const { announcementId } = req.params;
    const ownerId = req.user.id;

    const announcement = await Announcement.findOne({
      _id: announcementId,
      ownerId,
    });

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: announcement,
    });
  } catch (error) {
    console.error("Error fetching announcement:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch announcement",
      error: error.message,
    });
  }
};

// Get announcement statistics
exports.getAnnouncementStats = async (req, res) => {
  try {
    const { announcementId } = req.params;
    const ownerId = req.user.id;

    const announcement = await Announcement.findOne({
      _id: announcementId,
      ownerId,
    });

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    const stats = announcement.getDeliveryStats();

    return res.status(200).json({
      success: true,
      data: {
        title: announcement.title,
        announcementType: announcement.announcementType,
        priority: announcement.priority,
        status: announcement.status,
        ...stats,
        recentDeliveries: announcement.deliveryLog.slice(-10),
      },
    });
  } catch (error) {
    console.error("Error fetching announcement stats:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch stats",
      error: error.message,
    });
  }
};

// Update announcement
exports.updateAnnouncement = async (req, res) => {
  try {
    const { announcementId } = req.params;
    const ownerId = req.user.id;
    const updateData = req.body;

    const announcement = await Announcement.findOneAndUpdate(
      { _id: announcementId, ownerId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Announcement updated successfully",
      data: announcement,
    });
  } catch (error) {
    console.error("Error updating announcement:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update announcement",
      error: error.message,
    });
  }
};

// Delete announcement
exports.deleteAnnouncement = async (req, res) => {
  try {
    const { announcementId } = req.params;
    const ownerId = req.user.id;

    const announcement = await Announcement.findOneAndDelete({
      _id: announcementId,
      ownerId,
    });

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Announcement deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting announcement:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete announcement",
      error: error.message,
    });
  }
};

// Preview announcement message
exports.previewAnnouncementMessage = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { title, message, priority } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: "Title and message are required",
      });
    }

    // Get owner details
    const owner = await Owner.findById(ownerId);
    const gymName = getGymName(owner);
    const ownerName = getOwnerName(owner);

    // Get a sample member
    const sampleMember = await Member.findOne({ ownerId }).limit(1);
    const sampleName = sampleMember ? sampleMember.name : "Member";

    // Create temporary announcement object
    const tempAnnouncement = {
      title,
      message,
      priority: priority || "Medium",
      getWhatsAppMessage: Announcement.schema.methods.getWhatsAppMessage,
    };

    const previewWhatsAppMessage = tempAnnouncement.getWhatsAppMessage(
      sampleName,
      gymName
    );
    const previewEmailHtml = getAnnouncementEmail({
      memberName: sampleName,
      gymName,
      ownerName,
      title,
      message,
      priority: priority || "Medium",
      announcementType: "General",
    });

    return res.status(200).json({
      success: true,
      data: {
        message: previewWhatsAppMessage,
        characterCount: previewWhatsAppMessage.length,
        estimatedSMS: Math.ceil(previewWhatsAppMessage.length / 160),
        emailSubject: `[${gymName}] ${title}`,
        emailHtml: previewEmailHtml,
      },
    });
  } catch (error) {
    console.error("Error previewing announcement:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to preview announcement",
      error: error.message,
    });
  }
};
