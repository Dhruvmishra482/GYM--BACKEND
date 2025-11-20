// Utils/mailSender.js - PRODUCTION READY WITH TIMEOUT & RETRY
const nodemailer = require("nodemailer");

const mailSender = async (to, subject, html, retries = 2) => {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`📧 Email attempt ${attempt}/${retries}`);
      console.log("To:", to);
      console.log("Subject:", subject);

      // Validate environment variables
      if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
        throw new Error(
          "Email credentials not configured. Please check MAIL_USER and MAIL_PASS in .env file"
        );
      }

      // Create transporter
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
        tls: {
          rejectUnauthorized: false,
        },
        // ✅ ADD TIMEOUTS
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000, // 10 seconds
        socketTimeout: 10000, // 10 seconds
      });

      // Verify with timeout
      console.log("🔍 Verifying email server connection...");
      const verifyPromise = transporter.verify();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Verification timeout")), 10000)
      );

      await Promise.race([verifyPromise, timeoutPromise]);
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

      // Send with timeout
      console.log("📤 Sending email...");
      const sendPromise = transporter.sendMail(mailOptions);
      const sendTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Send email timeout")), 15000)
      );

      const info = await Promise.race([sendPromise, sendTimeoutPromise]);

      console.log("✅ Email sent successfully:", info.messageId);
      console.log("Accepted:", info.accepted);
      console.log("Rejected:", info.rejected);

      return info;
    } catch (error) {
      lastError = error;
      console.error(`❌ Email attempt ${attempt} failed:`, {
        message: error.message,
        code: error.code,
        attempt: attempt,
      });

      // If it's the last attempt, throw the error
      if (attempt === retries) {
        console.error("❌ All email attempts failed");

        // Provide more specific error messages
        if (error.code === "EAUTH") {
          throw new Error(
            "Email authentication failed. Please check your Gmail app password."
          );
        } else if (
          error.code === "ESOCKET" ||
          error.message.includes("timeout")
        ) {
          throw new Error(
            "Email service timeout. Please try again in a moment."
          );
        } else if (error.code === "ECONNECTION") {
          throw new Error(
            "Cannot connect to email server. Please try again later."
          );
        }

        throw error;
      }

      // Wait before retry (exponential backoff)
      const waitTime = 1000 * attempt;
      console.log(`⏳ Waiting ${waitTime}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  throw lastError;
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
