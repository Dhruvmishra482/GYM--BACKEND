// services/contactService.js
const { mailSender } = require('../utils/mailSender');

const contactEmailService = {
  // Main function to send contact emails
  sendContactEmails: async (contactData) => {
    try {
      const {
        name,
        email,
        phone,
        subject,
        inquiry,
        message,
        gymName,
        ownerName,
        submittedAt,
        userAgent,
        ipAddress,
        isLoggedInUser,
        userInfo
      } = contactData;

      // Generate admin email content
      const adminEmailHtml = generateAdminEmailTemplate(contactData);
      
      // Email subject for admin
      const adminSubject = `🔥 New Contact Form: ${subject} (${inquiry.toUpperCase()})`;
      
      // Admin email (where you want to receive the contact forms)
      const adminEmail = process.env.ADMIN_EMAIL || process.env.MAIL_USER;
      
      // Send email to admin
      const adminEmailResult = await mailSender(adminEmail, adminSubject, adminEmailHtml);
      
      // Send confirmation email to user
      const userConfirmationHtml = generateUserConfirmationTemplate(contactData);
      const userSubject = `Thank you for contacting FitForge - We received your message`;
      
      const userEmailResult = await mailSender(email, userSubject, userConfirmationHtml);

      return {
        success: true,
        adminEmailId: adminEmailResult.messageId,
        userEmailId: userEmailResult.messageId,
        timestamp: submittedAt
      };

    } catch (error) {
      console.error('Contact email service error:', error);
      throw new Error('Failed to send contact emails: ' + error.message);
    }
  }
};

// Email template for admin notification (You will receive this)
const generateAdminEmailTemplate = (data) => {
  const {
    name,
    email,
    phone,
    subject,
    inquiry,
    message,
    gymName,
    ownerName,
    submittedAt,
    userAgent,
    ipAddress,
    isLoggedInUser,
    userInfo
  } = data;

  const formattedDate = new Date(submittedAt).toLocaleString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata'
  });

  const inquiryTypes = {
    general: '💬 General Inquiry',
    sales: '💰 Sales & Pricing',
    support: '🛠️ Technical Support',
    demo: '🎯 Request Demo',
    partnership: '🤝 Partnership'
  };

  const priorityLevel = inquiry === 'sales' || inquiry === 'demo' ? 'HIGH' : 
                      inquiry === 'support' ? 'MEDIUM' : 'NORMAL';

  const priorityColor = priorityLevel === 'HIGH' ? '#ff4444' : 
                       priorityLevel === 'MEDIUM' ? '#ff8800' : '#4CAF50';

  // User type badge
  const userTypeBadge = isLoggedInUser ? 
    '<div style="background-color: #4CAF50; color: white; text-align: center; padding: 8px; font-weight: bold; font-size: 12px;">🔐 LOGGED-IN USER (EXISTING CUSTOMER)</div>' :
    '<div style="background-color: #2196F3; color: white; text-align: center; padding: 8px; font-weight: bold; font-size: 12px;">👤 ANONYMOUS VISITOR (POTENTIAL CUSTOMER)</div>';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Contact Form Submission</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">🔥 FitForge</h1>
          <p style="color: #e8eaff; margin: 10px 0 0 0; font-size: 16px;">New Contact Form Submission</p>
        </div>

        <!-- User Type Badge -->
        ${userTypeBadge}

        <!-- Priority Badge -->
        <div style="background-color: ${priorityColor}; color: white; text-align: center; padding: 10px; font-weight: bold; font-size: 14px;">
          🚨 PRIORITY: ${priorityLevel} - ${inquiryTypes[inquiry] || inquiry}
        </div>

        <!-- Main Content -->
        <div style="padding: 30px;">
          
          <!-- Contact Person Details -->
          <div style="background-color: #f8f9ff; border-left: 4px solid #667eea; padding: 20px; margin-bottom: 20px;">
            <h2 style="color: #333; margin: 0 0 15px 0; font-size: 20px;">👤 Contact Person</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555; width: 120px;">Name:</td>
                <td style="padding: 8px 0; color: #333;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Email:</td>
                <td style="padding: 8px 0; color: #333;"><a href="mailto:${email}" style="color: #667eea; text-decoration: none;">${email}</a></td>
              </tr>
              ${phone ? `
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Phone:</td>
                <td style="padding: 8px 0; color: #333;"><a href="tel:${phone}" style="color: #667eea; text-decoration: none;">${phone}</a></td>
              </tr>
              ` : ''}
            </table>
          </div>

          <!-- Logged-in User Details (if applicable) -->
          ${isLoggedInUser && userInfo ? `
          <div style="background-color: #e8f5e8; border-left: 4px solid #4CAF50; padding: 20px; margin-bottom: 20px;">
            <h2 style="color: #333; margin: 0 0 15px 0; font-size: 20px;">🔐 Existing Customer Details</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555; width: 120px;">User ID:</td>
                <td style="padding: 8px 0; color: #333; font-family: monospace;">${userInfo.id}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Full Name:</td>
                <td style="padding: 8px 0; color: #333;">${userInfo.firstName} ${userInfo.lastName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Registered Email:</td>
                <td style="padding: 8px 0; color: #333;">${userInfo.email}</td>
              </tr>
              ${userInfo.mobileNumber ? `
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Registered Phone:</td>
                <td style="padding: 8px 0; color: #333;">${userInfo.mobileNumber}</td>
              </tr>
              ` : ''}
              ${userInfo.gymName ? `
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Registered Gym:</td>
                <td style="padding: 8px 0; color: #333;">${userInfo.gymName}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Account Type:</td>
                <td style="padding: 8px 0; color: #333; text-transform: uppercase;">${userInfo.accountType}</td>
              </tr>
            </table>
          </div>
          ` : ''}

          <!-- Gym Details (if provided) -->
          ${gymName || ownerName || (isLoggedInUser && userInfo?.gymName) ? `
          <div style="background-color: #fff8f0; border-left: 4px solid #ff8800; padding: 20px; margin-bottom: 20px;">
            <h2 style="color: #333; margin: 0 0 15px 0; font-size: 20px;">🏋️ Gym Information</h2>
            <table style="width: 100%; border-collapse: collapse;">
              ${gymName || (isLoggedInUser && userInfo?.gymName) ? `
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555; width: 120px;">Gym Name:</td>
                <td style="padding: 8px 0; color: #333;">${gymName || userInfo?.gymName}</td>
              </tr>
              ` : ''}
              ${ownerName || (isLoggedInUser && userInfo?.firstName) ? `
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Owner:</td>
                <td style="padding: 8px 0; color: #333;">${ownerName || (userInfo ? `${userInfo.firstName} ${userInfo.lastName}` : '')}</td>
              </tr>
              ` : ''}
            </table>
          </div>
          ` : ''}

          <!-- Message Details -->
          <div style="background-color: #f0fff4; border-left: 4px solid #4CAF50; padding: 20px; margin-bottom: 20px;">
            <h2 style="color: #333; margin: 0 0 15px 0; font-size: 20px;">💬 Message Details</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555; width: 120px;">Subject:</td>
                <td style="padding: 8px 0; color: #333; font-weight: bold;">${subject}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Type:</td>
                <td style="padding: 8px 0; color: #333;">${inquiryTypes[inquiry] || inquiry}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555; vertical-align: top;">Message:</td>
                <td style="padding: 8px 0; color: #333; line-height: 1.6;">${message.replace(/\n/g, '<br>')}</td>
              </tr>
            </table>
          </div>

          <!-- Technical Details -->
          <div style="background-color: #f5f5f5; border-left: 4px solid #888; padding: 20px; margin-bottom: 20px;">
            <h2 style="color: #333; margin: 0 0 15px 0; font-size: 18px;">🔧 Technical Information</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 5px 0; font-weight: bold; color: #555; width: 120px; font-size: 12px;">User Type:</td>
                <td style="padding: 5px 0; color: #666; font-size: 12px;">${isLoggedInUser ? 'Logged-in User (Existing Customer)' : 'Anonymous Visitor (Potential Customer)'}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; font-weight: bold; color: #555; font-size: 12px;">Submitted:</td>
                <td style="padding: 5px 0; color: #666; font-size: 12px;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; font-weight: bold; color: #555; font-size: 12px;">IP Address:</td>
                <td style="padding: 5px 0; color: #666; font-size: 12px;">${ipAddress}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; font-weight: bold; color: #555; font-size: 12px; vertical-align: top;">User Agent:</td>
                <td style="padding: 5px 0; color: #666; font-size: 12px; word-break: break-all;">${userAgent}</td>
              </tr>
            </table>
          </div>

          <!-- Quick Actions -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; text-align: center;">
            <h3 style="color: white; margin: 0 0 15px 0;">Quick Actions</h3>
            <div style="display: inline-block; margin: 0 10px;">
              <a href="mailto:${email}?subject=Re: ${subject}&body=Hi ${name},%0D%0A%0D%0AThank you for contacting FitForge!%0D%0A%0D%0A" style="background-color: white; color: #667eea; padding: 10px 20px; border-radius: 5px; text-decoration: none; font-weight: bold; display: inline-block;">✉️ Reply via Email</a>
            </div>
            ${phone ? `
            <div style="display: inline-block; margin: 0 10px;">
              <a href="tel:${phone}" style="background-color: #4CAF50; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; font-weight: bold; display: inline-block;">📞 Call Now</a>
            </div>
            ` : ''}
            ${isLoggedInUser ? `
            <div style="display: inline-block; margin: 0 10px;">
              <a href="#" style="background-color: #ff8800; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; font-weight: bold; display: inline-block;">👤 View User Profile</a>
            </div>
            ` : ''}
          </div>

        </div>

        <!-- Footer -->
        <div style="background-color: #333; color: #ccc; text-align: center; padding: 20px; font-size: 12px;">
          <p style="margin: 0;">This email was automatically generated by FitForge Contact Form</p>
          <p style="margin: 5px 0 0 0;">© ${new Date().getFullYear()} FitForge - Gym Management System</p>
        </div>

      </div>
    </body>
    </html>
  `;
};

// Email template for user confirmation
const generateUserConfirmationTemplate = (data) => {
  const { name, subject, inquiry, submittedAt } = data;

  const formattedDate = new Date(submittedAt).toLocaleString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata'
  });

  const inquiryTypes = {
    general: 'General Inquiry',
    sales: 'Sales & Pricing',
    support: 'Technical Support',
    demo: 'Request Demo',
    partnership: 'Partnership'
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Thank You - Message Received</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 32px; font-weight: bold;">🔥 FitForge</h1>
          <p style="color: #e8eaff; margin: 15px 0 0 0; font-size: 18px;">Thank You for Contacting Us!</p>
        </div>

        <!-- Main Content -->
        <div style="padding: 40px;">
          
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="background-color: #4CAF50; color: white; border-radius: 50%; width: 60px; height: 60px; display: inline-flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 20px;">✓</div>
            <h2 style="color: #333; margin: 0; font-size: 24px;">Message Received Successfully!</h2>
          </div>

          <div style="background-color: #f8f9ff; border-left: 4px solid #667eea; padding: 25px; margin-bottom: 25px;">
            <p style="color: #333; margin: 0 0 15px 0; font-size: 16px;">Hi <strong>${name}</strong>,</p>
            <p style="color: #666; margin: 0; line-height: 1.6;">
              Thank you for reaching out to us! We have received your message regarding "<strong>${subject}</strong>" 
              and our team will review it carefully. We appreciate your interest in FitForge.
            </p>
          </div>

          <!-- Message Summary -->
          <div style="background-color: #fff8f0; border-left: 4px solid #ff8800; padding: 20px; margin-bottom: 25px;">
            <h3 style="color: #333; margin: 0 0 15px 0; font-size: 18px;">📋 Your Message Summary</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555; width: 140px;">Subject:</td>
                <td style="padding: 8px 0; color: #333;">${subject}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Inquiry Type:</td>
                <td style="padding: 8px 0; color: #333;">${inquiryTypes[inquiry] || inquiry}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #555;">Submitted On:</td>
                <td style="padding: 8px 0; color: #333;">${formattedDate}</td>
              </tr>
            </table>
          </div>

          <!-- What's Next -->
          <div style="background-color: #f0fff4; border-left: 4px solid #4CAF50; padding: 20px; margin-bottom: 25px;">
            <h3 style="color: #333; margin: 0 0 15px 0; font-size: 18px;">🚀 What's Next?</h3>
            <ul style="color: #666; line-height: 1.8; margin: 0; padding-left: 20px;">
              <li><strong>Response Time:</strong> We typically respond within 2-4 business hours</li>
              <li><strong>Sales Inquiries:</strong> Priority response within 1 hour during business hours</li>
              <li><strong>Technical Support:</strong> Our support team will assist you promptly</li>
              <li><strong>Demos:</strong> We'll schedule a personalized demo at your convenience</li>
            </ul>
          </div>

          <!-- Contact Information -->
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center;">
            <h3 style="color: #333; margin: 0 0 15px 0;">Need Immediate Assistance?</h3>
            <p style="color: #666; margin: 0 0 15px 0;">Feel free to reach out to us directly:</p>
            <div style="margin: 10px 0;">
              <a href="mailto:support@fitforge.com" style="color: #667eea; text-decoration: none; font-weight: bold;">📧 support@fitforge.com</a>
            </div>
            <div style="margin: 10px 0;">
              <a href="tel:+1234567890" style="color: #667eea; text-decoration: none; font-weight: bold;">📞 +91 12345 67890</a>
            </div>
          </div>

        </div>

        <!-- Footer -->
        <div style="background-color: #333; color: #ccc; text-align: center; padding: 30px; font-size: 14px;">
          <p style="margin: 0 0 10px 0;">Thank you for choosing FitForge!</p>
          <p style="margin: 0; font-size: 12px;">© ${new Date().getFullYear()} FitForge - Revolutionary Gym Management System</p>
        </div>

      </div>
    </body>
    </html>
  `;
};

module.exports = { contactEmailService };