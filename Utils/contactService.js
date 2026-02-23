// services/contactService.js - REDESIGNED MODERN EMAIL TEMPLATES
const { mailSender } = require("../Utils/mailSender");

const contactEmailService = {
  // Main function to send contact emails
  sendContactEmails: async (contactData) => {
    try {
      console.log("🔄 Starting contact email process...");

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
        userInfo,
      } = contactData;

      // Validate required fields
      if (!email || !name || !message) {
        throw new Error("Missing required fields: email, name, or message");
      }

      const adminEmail = process.env.ADMIN_EMAIL || process.env.MAIL_USER;

      console.log("📧 Admin email:", adminEmail);
      console.log("📧 User email:", email);

      let adminEmailResult = null;
      let userEmailResult = null;
      let errors = [];

      // Send admin email first
      try {
        console.log("📤 Sending email to admin...");
        const adminEmailHtml = generateModernAdminEmailTemplate(contactData);
        const adminSubject = `🔔 New Contact Request: ${subject}`;

        adminEmailResult = await mailSender(
          adminEmail,
          adminSubject,
          adminEmailHtml
        );
        console.log("✅ Admin email sent successfully");
      } catch (adminError) {
        console.error("❌ Failed to send admin email:", adminError.message);
        errors.push({ type: "admin", error: adminError.message });
      }

      // Send user confirmation email
      try {
        console.log("📤 Sending confirmation email to user...");
        const userConfirmationHtml =
          generateModernUserConfirmationTemplate(contactData);
        const userSubject = `We received your message - FitTracker Team`;

        userEmailResult = await mailSender(
          email,
          userSubject,
          userConfirmationHtml
        );
        console.log("✅ User confirmation email sent successfully");
      } catch (userError) {
        console.error(
          "❌ Failed to send user confirmation:",
          userError.message
        );
        errors.push({ type: "user", error: userError.message });
      }

      if (!adminEmailResult && !userEmailResult) {
        console.error("❌ Both email sends failed");
        throw new Error(
          "Failed to send any emails. Please check email configuration."
        );
      }

      if (!adminEmailResult) {
        console.warn("⚠️ Admin email failed but user confirmation sent");
        throw new Error(
          "Failed to notify admin. Contact form may not be processed."
        );
      }

      return {
        success: true,
        adminEmailId: adminEmailResult?.messageId,
        userEmailId: userEmailResult?.messageId,
        timestamp: submittedAt,
        warnings: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      console.error("❌ Contact email service error:", error);

      if (
        error.message.includes("authentication") ||
        error.message.includes("EAUTH")
      ) {
        throw new Error(
          "Email service authentication failed. Please contact support at govind@fittracker.in"
        );
      } else if (
        error.message.includes("network") ||
        error.message.includes("ESOCKET")
      ) {
        throw new Error("Network error. Please try again in a few moments.");
      } else if (error.message.includes("configuration")) {
        throw new Error(
          "Email service not properly configured. Please contact support."
        );
      }

      throw error;
    }
  },
};

// 🎨 REDESIGNED MODERN ADMIN EMAIL TEMPLATE - With Proper Spacing
const generateModernAdminEmailTemplate = (data) => {
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
    userInfo,
  } = data;

  const formattedDate = new Date(submittedAt).toLocaleString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

  const inquiryLabels = {
    general: "General Inquiry",
    sales: "Sales & Pricing",
    support: "Technical Support",
    demo: "Demo Request",
    partnership: "Partnership Opportunity",
  };

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Contact Request - FitTracker</title>
      <style>
        * { 
          margin: 0; 
          padding: 0; 
          box-sizing: border-box; 
        }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
          background-color: #f5f5f5; 
          padding: 30px 15px;
          line-height: 1.6; 
        }
        .email-wrapper { 
          max-width: 650px; 
          margin: 0 auto; 
          background: #ffffff;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }
        
        /* Header */
        .header { 
          background: #000000; 
          padding: 50px 40px; 
          text-align: center; 
          color: white; 
        }
        .logo { 
          font-size: 32px; 
          font-weight: 700; 
          margin-bottom: 12px; 
          letter-spacing: -0.8px;
        }
        .header-subtitle { 
          font-size: 15px; 
          opacity: 0.75; 
          font-weight: 400; 
        }

        /* Tab Navigation */
        .tab-nav {
          background: #1a1a1a;
          padding: 0 40px;
          display: flex;
          gap: 20px;
          border-bottom: 2px solid #333;
        }
        .tab {
          color: #888;
          padding: 18px 0;
          font-size: 14px;
          font-weight: 600;
          border: none;
          background: transparent;
          position: relative;
        }
        .tab.active {
          color: #fff;
        }
        .tab.active::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          right: 0;
          height: 2px;
          background: #fff;
        }

        /* Content */
        .content { 
          padding: 0; 
          background: #fafafa;
        }
        
        /* Section Styles */
        .section { 
          background: #ffffff;
          padding: 35px 40px;
          margin-bottom: 10px;
        }
        .section-title { 
          font-size: 18px; 
          font-weight: 700; 
          color: #000000; 
          margin-bottom: 25px;
          letter-spacing: -0.3px;
        }
        
        /* Info Grid with Better Spacing */
        .info-grid {
          display: table;
          width: 100%;
          border-spacing: 0;
        }
        .info-row {
          display: table-row;
        }
        .info-row > div {
          display: table-cell;
          padding: 16px 0;
          border-bottom: 1px solid #efefef;
          vertical-align: top;
        }
        .info-row:last-child > div {
          border-bottom: none;
        }
        .info-label { 
          font-weight: 500; 
          color: #666; 
          font-size: 14px; 
          width: 160px;
          padding-right: 20px;
        }
        .info-value { 
          color: #000000; 
          font-size: 14px; 
          font-weight: 500;
          word-break: break-word;
          margin-left: 30px;
        }
        .info-value a { 
          color: #0066cc; 
          text-decoration: none; 
        }
        .info-value a:hover { 
          text-decoration: underline; 
        }
        
        /* Message Box with Better Spacing */
        .message-box { 
          background: #f9f9f9; 
          padding: 25px; 
          border-radius: 8px; 
          margin-top: 25px;
          border: 1px solid #e5e5e5;
        }
        .message-text { 
          color: #333; 
          font-size: 15px; 
          line-height: 1.8; 
          white-space: pre-wrap; 
        }
        
        /* Action Buttons with Better Spacing */
        .action-buttons { 
          display: flex; 
          justify-content: center;   /* Centers buttons */
          align-items: center;       /* Align vertically */
          margin-top: 30px;
          gap: 20px;                 /* Space between buttons */
        }

        .btn { 
          flex: 1;
          padding: 16px 24px; 
          border-radius: 8px; 
          text-decoration: none; 
          font-weight: 600; 
          font-size: 15px; 
          text-align: center; 
          display: inline-block;
          transition: all 0.2s ease;
        }
        .btn-primary { 
          background: #000000; 
          color: white; 
        }
        .btn-primary:hover { 
          background: #222; 
        }
        .btn-secondary { 
          background: #333333; 
          color: white; 
           margin-left: 30px;
        }
        .btn-secondary:hover { 
          background: #444; 
        }
        
        /* Badge with Better Spacing */
        .badge { 
          display: inline-block; 
          padding: 6px 14px; 
          border-radius: 5px; 
          font-size: 12px; 
          font-weight: 700; 
          text-transform: uppercase; 
          letter-spacing: 0.5px; 
        }
        .badge-new { 
          background: #000000; 
          color: #ffffff; 
        }
        .badge-existing { 
          background: #10b981; 
          color: #ffffff; 
        }
       .head-lead { 
          position: absolute;
          right: 20px;
        }

        
        /* Footer */
        .footer { 
          background: #000000; 
          color: #999; 
          padding: 40px; 
          text-align: center; 
          font-size: 13px;
        }
        .footer-text { 
          margin-bottom: 10px; 
          line-height: 1.7;
        }
        .footer-brand { 
          color: #ffffff; 
          margin-top: 20px; 
          font-size: 14px;
          font-weight: 600;
        }
        
        @media only screen and (max-width: 600px) {
          body { padding: 0; }
          .email-wrapper { box-shadow: none; }
          .header { padding: 40px 25px; }
          .section { padding: 25px 20px; }
          .tab-nav { padding: 0 20px; gap: 15px; }
          .action-buttons { flex-direction: column; }
          .btn { width: 100%; }
          .info-grid { display: block; }
          .info-row { display: block; }
          .info-row > div { 
            display: block; 
            padding: 10px 0;
          }
          .info-label { 
            width: 100%; 
            margin-bottom: 4px;
            padding-right: 0;
          }
          .info-value { 
            padding-bottom: 15px;
          }
          .info-value span { 
            margin-left: 30px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        
        <!-- Header -->
        <div class="header">
          <div class="logo">FitTracker</div>
          <div class="header-subtitle">New Contact Request</div>
        </div>

        <!-- Tab Navigation -->
        <div class="tab-nav">
          <div class="tab active">${inquiryLabels[inquiry] || inquiry}</div>
          <div class="tab head-lead">${
            isLoggedInUser ? "EXISTING CUSTOMER" : "NEW LEAD"
          }</div>
        </div>

        <!-- Content -->
        <div class="content">
          
          <!-- Contact Information -->
          <div class="section">
            <div class="section-title">Contact Information</div>
            <div class="info-grid">
              <div class="info-row">
                <div class="info-label">Full Name: </div>
                <div class="info-value">${name}</div>
              </div>
              <div class="info-row">
                <div class="info-label">Email Address: </div>
                <div class="info-value"><a href="mailto:${email}">${email}</a></div>
              </div>
              ${
                phone
                  ? `
              <div class="info-row">
                <div class="info-label">Phone Number: </div>
                <div class="info-value"><a href="tel:${phone}">${phone}</a></div>
              </div>
              `
                  : ""
              }
              <div class="info-row">
                <div class="info-label">Submitted On: </div>
                <div class="info-value">${formattedDate}</div>
              </div>
            </div>

            <div class="action-buttons">
              <a href="mailto:${email}?subject=Re: ${encodeURIComponent(
    subject
  )}" class="btn btn-primary">Reply via Email</a>
              ${
                phone
                  ? `<a href="tel:${phone}" class="btn btn-secondary">Call Now</a>`
                  : ""
              }
            </div>
          </div>

          ${
            gymName || ownerName
              ? `
          <!-- Business Information -->
          <div class="section">
            <div class="section-title">Business Information</div>
            <div class="info-grid">
              ${
                gymName
                  ? `
              <div class="info-row">
                <div class="info-label">Gym/Business Name :</div>
                <div class="info-value">${gymName}</div>
              </div>
              `
                  : ""
              }
              ${
                ownerName
                  ? `
              <div class="info-row">
                <div class="info-label">Owner/Manager: </div>
                <div class="info-value">${ownerName}</div>
              </div>
              `
                  : ""
              }
            </div>
          </div>
          `
              : ""
          }

          ${
            isLoggedInUser && userInfo
              ? `
          <!-- Customer Account Details -->
          <div class="section">
            <div class="section-title">Customer Account Details</div>
            <div class="info-grid">
              <div class="info-row">
                <div class="info-label">User ID: </div>
                <div class="info-value">${userInfo.id}</div>
              </div>
              <div class="info-row">
                <div class="info-label">Account Name: </div>
                <div class="info-value">${userInfo.firstName} ${
                  userInfo.lastName
                }</div>
              </div>
              <div class="info-row">
                <div class="info-label">Registered Email: </div>
                <div class="info-value">${userInfo.email}</div>
              </div>
              ${
                userInfo.mobileNumber
                  ? `
              <div class="info-row">
                <div class="info-label">Registered Phone: </div>
                <div class="info-value">${userInfo.mobileNumber}</div>
              </div>
              `
                  : ""
              }
              ${
                userInfo.gymName
                  ? `
              <div class="info-row">
                <div class="info-label">Gym Name: </div>
                <div class="info-value">${userInfo.gymName}</div>
              </div>
              `
                  : ""
              }
              <div class="info-row">
                <div class="info-label">Account Type: </div>
                <div class="info-value"><span class="badge badge-existing">${userInfo.accountType.toUpperCase()}</span></div>
              </div>
            </div>
          </div>
          `
              : ""
          }

          <!-- Message Details -->
          <div class="section">
            <div class="section-title">Message Details</div>
            <div class="info-grid">
              <div class="info-row">
                <div class="info-label">Subject: </div>
                <div class="info-value">${subject}</div>
              </div>
              <div class="info-row">
                <div class="info-label">Inquiry Type: </div>
                <div class="info-value">${
                  inquiryLabels[inquiry] || inquiry
                }</div>
              </div>
            </div>
            
            <div class="message-box">
              <div class="message-text">${message}</div>
            </div>
          </div>

          <!-- Technical Details -->
          <div class="section">
            <div class="section-title">Technical Details</div>
            <div class="info-grid">
              <div class="info-row">
                <div class="info-label">Lead Type: </div>
                <div class="info-value"><span class="badge ${
                  isLoggedInUser ? "badge-existing" : "badge-new"
                }">${
    isLoggedInUser ? "Existing Customer" : "New Lead"
  }</span></div>
              </div>
              <div class="info-row">
                <div class="info-label">IP Address </div>
                <div class="info-value">${ipAddress}</div>
              </div>
              <div class="info-row">
                <div class="info-label">User Agent: </div>
                <div class="info-value">${userAgent}</div>
              </div>
            </div>
          </div>

        </div>

        <!-- Footer -->
        <div class="footer">
          <div class="footer-text">This email was automatically generated by FitTracker Contact System</div>
          <div class="footer-text">Respond promptly to maintain high customer satisfaction</div>
          <div class="footer-brand">© ${new Date().getFullYear()} FitTracker</div>
        </div>

      </div>
    </body>
    </html>
  `;
};

// 🎨 REDESIGNED USER CONFIRMATION EMAIL TEMPLATE - With Proper Spacing
const generateModernUserConfirmationTemplate = (data) => {
  const { name, subject, inquiry, submittedAt } = data;

  const formattedDate = new Date(submittedAt).toLocaleString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

  const inquiryLabels = {
    general: "General Inquiry",
    sales: "Sales & Pricing",
    support: "Technical Support",
    demo: "Demo Request",
    partnership: "Partnership Opportunity",
  };

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Message Received - FitTracker</title>
      <style>
        * { 
          margin: 0; 
          padding: 0; 
          box-sizing: border-box; 
        }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
          background-color: #f5f5f5; 
          padding: 30px 15px;
          line-height: 1.6; 
        }
        .email-wrapper { 
          max-width: 650px; 
          margin: 0 auto; 
          background: #ffffff;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }
        
        /* Header with Checkmark */
        .header { 
          background: #000000; 
          padding: 60px 40px 50px; 
          text-align: center; 
          color: white; 
        }
       .checkmark {
          width: 80px;
          height: 80px;
          background: #fff;
          border-radius: 50%;
          display: flex;
          justify-content: center; /* center horizontally */
          align-items: center;     /* center vertically */
          font-size: 45px;
          font-weight: 700;
          color: #000;
          margin: 0 auto 30px;     /* center container */
}

        .logo { 
          font-size: 32px; 
          font-weight: 700; 
          margin-bottom: 18px; 
          letter-spacing: -0.8px;
        }
        .header-title { 
          font-size: 24px; 
          font-weight: 700; 
          margin-bottom: 10px; 
        }
        .header-subtitle { 
          font-size: 15px; 
          opacity: 0.75; 
          font-weight: 400; 
        }

        /* Content */
        .content { 
          padding: 45px 40px; 
          background: #ffffff;
        }
        
        .greeting { 
          font-size: 20px; 
          font-weight: 700; 
          color: #000000; 
          margin-bottom: 25px; 
        }
        
        .message { 
          color: #444; 
          font-size: 16px; 
          line-height: 1.8; 
          margin-bottom: 35px; 
        }

        /* Summary Box */
        .summary-box { 
          background: #fafafa; 
          border-radius: 10px; 
          padding: 30px; 
          margin-bottom: 35px;
          border: 1px solid #e8e8e8;
        }
        .summary-title { 
          font-size: 18px; 
          font-weight: 700; 
          color: #000000; 
          margin-bottom: 25px;
          letter-spacing: -0.3px;
        }
        .summary-grid {
          display: table;
          width: 100%;
          border-spacing: 0;
        }
        .summary-row {
          display: table-row;
        }
        .summary-row > div {
          display: table-cell;
          padding: 16px 0;
          border-bottom: 1px solid #e5e5e5;
          vertical-align: top;
        }
        .summary-row:last-child > div {
          border-bottom: none;
        }
        .summary-label { 
          font-weight: 500; 
          color: #666; 
          font-size: 14px; 
          width: 140px;
          padding-right: 20px;
        }
        .summary-value { 
          color: #000000; 
          font-size: 14px; 
          font-weight: 500;
        }

        /* What Happens Next Box */
        .info-box { 
          background: #fafafa; 
          border-radius: 10px; 
          padding: 30px; 
          margin-bottom: 35px;
          border: 1px solid #e8e8e8;
        }
        .info-title { 
          font-size: 18px; 
          font-weight: 700; 
          color: #000000; 
          margin-bottom: 25px;
          letter-spacing: -0.3px;
        }
        .info-list { 
          list-style: none; 
          padding: 0; 
          margin: 0;
        }
        .info-list li { 
          padding: 14px 0; 
          color: #444; 
          font-size: 15px; 
          display: flex; 
          align-items: flex-start; 
          gap: 15px;
          line-height: 1.7;
        }
        .info-list li:before { 
          content: "●"; 
          color: #000000; 
          font-weight: 700; 
          font-size: 16px;
          margin-top: 3px;
          flex-shrink: 0;
        }

        /* Contact Box */
        .contact-box { 
          background: #000000; 
          color: white; 
          border-radius: 10px; 
          padding: 40px; 
          text-align: center; 
          margin-bottom: 35px; 
        }
        .contact-title { 
          font-size: 20px; 
          font-weight: 700; 
          margin-bottom: 15px; 
        }
        .contact-subtitle { 
          font-size: 15px; 
          opacity: 0.75; 
          margin-bottom: 25px; 
        }
       .contact-buttons { 
        display: flex; 
        justify-content: center;   /* centers horizontally */
        align-items: center;        /* centers vertically */
        gap: 15px;                  /* space between buttons */
        max-width: 400px;
        margin: 0 auto;             /* centers entire container */
      }

        .contact-btn { 
          flex: 1;
          padding: 16px 24px; 
          border-radius: 8px; 
          text-decoration: none; 
          font-weight: 600; 
          font-size: 15px; 
          text-align: center; 
          display: inline-block;
          transition: all 0.2s ease;
        }
        .btn-white { 
          background: #ffffff; 
          color: #000000; 
        }
        .btn-white:hover { 
          background: #f5f5f5; 
        }
        .btn-outline { 
          background: transparent; 
          color: #ffffff;
          border: 2px solid rgba(255,255,255,0.3);
        }
        .btn-outline:hover { 
          border-color: rgba(255,255,255,0.5); 
        }

        /* Business Hours */
        .business-hours {
          text-align: center;
          color: #666;
          font-size: 15px;
          line-height: 1.8;
          margin-top: 30px;
        }
        .business-hours strong {
          color: #000;
          font-weight: 600;
        }

        /* Footer */
        .footer { 
          background: #fafafa; 
          padding: 40px; 
          text-align: center; 
          color: #666; 
          font-size: 13px;
          border-top: 1px solid #e8e8e8;
        }
        .footer-text { 
          margin-bottom: 10px; 
          line-height: 1.7;
        }
        .footer-brand { 
          color: #000000; 
          margin-top: 20px; 
          font-size: 14px;
          font-weight: 700;
        }
        
        @media only screen and (max-width: 600px) {
          body { padding: 0; }
          .email-wrapper { box-shadow: none; }
          .header { padding: 50px 25px 40px; }
          .content { padding: 35px 25px; }
          .summary-box, .info-box, .contact-box { padding: 25px; }
          .contact-buttons { flex-direction: column; }
          .contact-btn { max-width: 100%; }
          .summary-grid { display: block; }
          .summary-row { display: block; }
          .summary-row > div { 
            display: block; 
            padding: 10px 0;
          }
          .summary-label { 
            width: 100%; 
            margin-bottom: 4px;
            padding-right: 0;
          }
          .summary-value { 
            padding-bottom: 15px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        
        <!-- Header -->
        <div class="header">
          // <div class="checkmark">✓</div>
          <div class="logo">FitTracker</div>
          <div class="header-title">Message Received!</div>
          <div class="header-subtitle">We'll be in touch soon</div>
        </div>

        <!-- Content -->
        <div class="content">
          
          <div class="greeting">Hi ${name}</div>
          
          <div class="message">
            Thank you for reaching out to FitTracker! We've received your message and our team is already reviewing it. We're excited to help you transform your gym management experience.
          </div>

          <!-- Message Summary -->
          <div class="summary-box">
            <div class="summary-title">Your Message Summary</div>
            <div class="summary-grid">
              <div class="summary-row">
                <div class="summary-label">Subject: </div>
                <div class="summary-value">${subject}</div>
              </div>
              <div class="summary-row">
                <div class="summary-label">Inquiry Type: </div>
                <div class="summary-value">${
                  inquiryLabels[inquiry] || inquiry
                }</div>
              </div>
              <div class="summary-row">
                <div class="summary-label">Submitted On: </div>
                <div class="summary-value">${formattedDate}</div>
              </div>
            </div>
          </div>

          <!-- What Happens Next -->
          <div class="info-box">
            <div class="info-title">What Happens Next?</div>
            <ul class="info-list">
              <li><strong>Quick Response: </strong> We typically respond within 2-4 business hours</li>
              <li><strong>Personal Touch: </strong> A dedicated team member will reach out to you</li>
              <li><strong>Tailored Solution: </strong> We'll provide answers specific to your needs</li>
              <li><strong>Next Steps: </strong> We'll guide you through everything you need to know</li>
            </ul>
          </div>

          <!-- Contact Box -->
          <div class="contact-box">
            <div class="contact-title">Need Immediate Help?</div>
            <div class="contact-subtitle">Our team is available to assist you right away</div>
            <div class="contact-buttons">
              <a href="mailto:govind@fittracker.in" class="contact-btn btn-white">Email Us</a>
              <a href="tel:+919465737989" class="contact-btn btn-outline">Call Now</a>
            </div>
          </div>

          <div class="business-hours">
            <p><strong>Business Hours:</strong> Monday - Friday, 10:00 AM - 11:00 PM IST</p>
            <p style="margin-top: 8px;">Emergency support available 24/7</p>
          </div>

        </div>

        <!-- Footer -->
        <div class="footer">
          <div class="footer-text">
            This email confirms we received your message<br>
            Please add our email to your contacts to ensure you receive our response
          </div>
          
          <div class="footer-brand">FitTracker</div>
          <div style="margin-top: 10px; color: #999;">© ${new Date().getFullYear()} FitTracker. All rights reserved.</div>
          
          <div style="margin-top: 18px; color: #999;">
            You're receiving this email because you contacted us through our website<br>
            Ludhiana, Punjab, India
          </div>
        </div>

      </div>
    </body>
    </html>
  `;
};

module.exports = { contactEmailService };
