// mailSender.js - BREVO SMTP VERSION (SUPER FAST, NO TIMEOUT ISSUES)
const nodemailer = require("nodemailer");

const mailSender = async (to, subject, html) => {
  try {
    console.log("📧 Sending email to:", to);

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST, // smtp-relay.brevo.com
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 8000,
      socketTimeout: 8000,
    });

    await transporter.verify();
    console.log("✅ SMTP connected.");

    const info = await transporter.sendMail({
      from: `"${process.env.MAIL_FROM_NAME}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });

    console.log("✔ Email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Email error:", error);
    throw new Error("Failed to send email");
  }
};

module.exports = { mailSender };
