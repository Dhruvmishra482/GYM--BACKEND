const nodemailer = require('nodemailer');

const mailSender = async (to, subject, html) => {
  try {
    // Fixed: Changed createTransporter to createTransport
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER, // dhruvmishra3828@gmail.com
        pass: process.env.MAIL_PASS,
      },
    });

    let recipients;
    if (Array.isArray(to)) {
      recipients = to.join(', ');
    } else {
      recipients = to;
    }

    const mailOptions = {
      from: `"${process.env.MAIL_FROM_NAME || 'Iron Throne Gym'}" <${process.env.MAIL_USER}>`,
      to: recipients,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error.message);
    throw error;
  }
};

// Sirf admins ko important emails (Contact form, etc.)
const sendAdminEmail = async (subject, html) => {
  const adminEmails = [
    process.env.MAIL_USER, // dhruvmishra3828@gmail.com
    'govindsingh988877@gmail.com' 
  ];
  
  return await mailSender(adminEmails, subject, html);
};

module.exports = { 
  mailSender,  // Original function - sirf customer ko
  sendAdminEmail  // Sirf admins ko - Contact form, important notifications
};