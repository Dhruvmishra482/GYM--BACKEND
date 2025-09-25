// Add this to your existing dashboardController.js
const {contactEmailService}=require("../../../../Utils/contactService")
const Owner = require('../../MemberCrud/Models//Owner'); // Import your Owner model

// Contact form submission handler (accessible to both logged-in and anonymous users)
exports.submitContactForm = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      subject,
      inquiry,
      message,
      gymName,
      ownerName
    } = req.body;

    // Check if user is logged in (optional authentication)
    let userInfo = null;
    let isLoggedInUser = false;
    
    // Try to get user info if token exists (but don't require it)
    const token = req.cookies?.token || 
                  req.body?.token || 
                  req.header("Authorization")?.replace("Bearer ", "");
    
    if (token) {
      try {
        const jwt = require("jsonwebtoken");
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userInfo = await Owner.findById(decoded.id).select('-password');
        if (userInfo) {
          isLoggedInUser = true;
          console.log(`Contact form from logged-in user: ${userInfo.firstName} ${userInfo.lastName} (${userInfo.email})`);
        }
      } catch (error) {
        console.log("Token invalid or user not found, treating as anonymous user");
        // Continue as anonymous user - don't return error
      }
    }

    console.log("Contact form submission: ", req.body);
    console.log("User logged in:", isLoggedInUser, userInfo ? `(${userInfo.firstName} ${userInfo.lastName})` : "Anonymous user");

    // Validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: "Name, email, subject, and message are required fields"
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address"
      });
    }

    // Prepare contact data with user context
    const contactData = {
      // Form data
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      subject: subject.trim(),
      inquiry: inquiry || 'general',
      message: message.trim(),
      gymName: gymName?.trim() || null,
      ownerName: ownerName?.trim() || null,
      
      // User context
      isLoggedInUser,
      userInfo: isLoggedInUser ? {
        id: userInfo._id,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
        email: userInfo.email,
        mobileNumber: userInfo.mobileNumber,
        gymName: userInfo.gymName || userInfo.businessName,
        accountType: userInfo.accountType
      } : null,
      
      // Technical data
      submittedAt: new Date().toISOString(),
      userAgent: req.get('User-Agent') || '',
      ipAddress: req.ip || req.connection.remoteAddress || ''
    };

    // Send email using service
    const result = await contactEmailService.sendContactEmails(contactData);

    console.log('Contact form submitted successfully:', {
      name: contactData.name,
      email: contactData.email,
      inquiry: contactData.inquiry,
      isLoggedInUser: contactData.isLoggedInUser,
      timestamp: contactData.submittedAt
    });

    res.status(200).json({
      success: true,
      message: "Your message has been sent successfully! We will get back to you soon.",
      data: {
        name: contactData.name,
        email: contactData.email,
        isLoggedInUser: contactData.isLoggedInUser,
        submittedAt: contactData.submittedAt
      }
    });

  } catch (error) {
    console.error("Contact form submission error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to send your message. Please try again later or contact us directly.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// import { useAuthStore } from "../../store/AuthStore"; // Import your auth store
// import { contactFormService } from "../services/contactFormService"; // Import the service we created
