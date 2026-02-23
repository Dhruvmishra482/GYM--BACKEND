const nodemailer = require("nodemailer");

const mailSender = async (to, subject, html) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST, // smtp.gmail.com
      port: process.env.MAIL_PORT, // 587
      secure: false, // Gmail TLS on port 587
      auth: {
        user: process.env.MAIL_USER, // fittacker@gmail.com
        pass: process.env.MAIL_PASS, // App Password
      },
    });

    const mailOptions = {
      from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_EMAIL}>`,
      to,
      subject,
      html,
    };

    console.log("📧 Sending email...");
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent:", info.messageId);

    return info;
  } catch (err) {
    console.error("❌ Email sending error:", err);
    throw new Error("Email sending failed");
  }
};

module.exports = { mailSender };
