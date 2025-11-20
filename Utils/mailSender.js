// Utils/mailSender.js - FIXED VERSION
const nodemailer = require("nodemailer");

const mailSender = async (to, subject, html) => {
  try {
    console.log("📧 Attempting to send email...");
    console.log("To:", to);
    console.log("Subject:", subject);

    // Validate environment variables
    if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
      throw new Error(
        "Email credentials not configured. Please check MAIL_USER and MAIL_PASS in .env file"
      );
    }

    // Create transporter (note: it's createTransport, not createTransporter)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
      // Add these for better reliability
      tls: {
        rejectUnauthorized: false,
      },
    });

    // Verify transporter configuration
    await transporter.verify();
    console.log("✅ Email server connection verified");

    // Handle multiple recipients
    let recipients;
    if (Array.isArray(to)) {
      recipients = to.join(", ");
    } else {
      recipients = to;
    }

    const mailOptions = {
      from: `"${process.env.MAIL_FROM_NAME || "FitTracker Gym"}" <${
        process.env.MAIL_USER
      }>`,
      to: recipients,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", info.messageId);
    console.log("Accepted:", info.accepted);
    console.log("Rejected:", info.rejected);

    return info;
  } catch (error) {
    console.error("❌ Error sending email:", {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });

    // Provide more specific error messages
    if (error.code === "EAUTH") {
      throw new Error(
        "Email authentication failed. Please check your Gmail app password."
      );
    } else if (error.code === "ESOCKET") {
      throw new Error("Network error. Please check your internet connection.");
    } else if (error.code === "ECONNECTION") {
      throw new Error(
        "Cannot connect to email server. Please try again later."
      );
    }

    throw error;
  }
};

// Send email to admins only (for contact forms, important notifications)
const sendAdminEmail = async (subject, html) => {
  const adminEmails = [
    process.env.MAIL_USER, // fittacker@gmail.com
    "govindsingh988877@gmail.com",
  ];

  console.log("📧 Sending admin notification to:", adminEmails);
  return await mailSender(adminEmails, subject, html);
};

module.exports = {
  mailSender, // For sending to customers
  sendAdminEmail, // For sending to admins
};
