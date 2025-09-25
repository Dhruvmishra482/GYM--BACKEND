// controllers/ownerProfileController.js
const Owner = require('../../MemberCrud/Models/Owner');

// Get owner profile with gym details
const getOwnerProfile = async (req, res) => {
  try {
    const owner = await Owner.findById(req.user.id).select('-password -otp -otpExpires');
    
    if (!owner) {
      return res.status(404).json({
        success: false,
        message: 'Owner profile not found'
      });
    }

    // Ensure gym details are included
    const gymDetails = owner.gymDetails || {
      gymName: null,
      gymLogo: null,
      isOnboardingComplete: false,
      onboardingCompletedAt: null
    };

    res.json({
      success: true,
      message: 'Profile fetched successfully',
      data: {
        id: owner._id,
        firstName: owner.firstName,
        lastName: owner.lastName,
        mobileNumber: owner.mobileNumber,
        email: owner.email,
        accountType: owner.accountType,
        isVerified: owner.isVerified,
        gymDetails: gymDetails,
        subscriptionPlan: owner.subscriptionPlan,
        subscriptionExpiry: owner.subscriptionExpiry,
        createdAt: owner.createdAt,
        updatedAt: owner.updatedAt
      }
    });

  } catch (error) {
    console.error('❌ Error fetching owner profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Update owner profile
const updateOwnerProfile = async (req, res) => {
  try {
    const { firstName, lastName, mobileNumber, email } = req.body;
    const ownerId = req.user.id;

    console.log('🔄 Updating owner profile for ID:', ownerId);
    console.log('📝 Update data:', { firstName, lastName, mobileNumber, email });

    const currentOwner = await Owner.findById(ownerId);
    if (!currentOwner) {
      console.log('❌ Owner not found');
      return res.status(404).json({
        success: false,
        message: 'Owner profile not found'
      });
    }

    // Validation - Check required fields
    if (!firstName || !lastName || !mobileNumber || !email) {
      console.log('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'All fields are required (firstName, lastName, mobileNumber, email)'
      });
    }

    // Validate first name
    if (firstName.trim().length < 2) {
      console.log('❌ First name too short');
      return res.status(400).json({
        success: false,
        message: 'First name must be at least 2 characters long'
      });
    }

    // Validate last name
    if (lastName.trim().length < 2) {
      console.log('❌ Last name too short');
      return res.status(400).json({
        success: false,
        message: 'Last name must be at least 2 characters long'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('❌ Invalid email format');
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Mobile number validation (Indian format)
    const cleanMobile = mobileNumber.replace(/\D/g, '');
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(cleanMobile.slice(-10))) {
      console.log('❌ Invalid mobile number format');
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 10-digit mobile number starting with 6-9'
      });
    }

    // Check for duplicates only if values changed
    const trimmedEmail = email.trim().toLowerCase();
    const emailChanged = trimmedEmail !== currentOwner.email.toLowerCase();
    
    if (emailChanged) {
      console.log('📧 Email changed, checking for duplicates...');
      const existingOwnerWithEmail = await Owner.findOne({ 
        email: trimmedEmail, 
        _id: { $ne: ownerId } 
      });
      
      if (existingOwnerWithEmail) {
        console.log('❌ Email already exists for another owner');
        return res.status(409).json({
          success: false,
          message: 'Email address is already in use by another account'
        });
      }
    }

    const mobileChanged = cleanMobile !== currentOwner.mobileNumber;
    if (mobileChanged) {
      console.log('📱 Mobile number changed, checking for duplicates...');
      const existingOwnerWithMobile = await Owner.findOne({ 
        mobileNumber: cleanMobile, 
        _id: { $ne: ownerId } 
      });
      
      if (existingOwnerWithMobile) {
        console.log('❌ Mobile number already exists for another owner');
        return res.status(409).json({
          success: false,
          message: 'Mobile number is already in use by another account'
        });
      }
    }

    // Update the owner profile
    const updatedOwner = await Owner.findByIdAndUpdate(
      ownerId,
      {
        $set: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          mobileNumber: cleanMobile,
          email: trimmedEmail
        }
      },
      { 
        new: true,
        runValidators: true
      }
    ).select('-password -otp -otpExpires');

    if (!updatedOwner) {
      console.log('❌ Owner not found for update');
      return res.status(404).json({
        success: false,
        message: 'Owner profile not found'
      });
    }

    console.log('✅ Owner profile updated successfully');
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updatedOwner._id,
        firstName: updatedOwner.firstName,
        lastName: updatedOwner.lastName,
        mobileNumber: updatedOwner.mobileNumber,
        email: updatedOwner.email,
        accountType: updatedOwner.accountType,
        isVerified: updatedOwner.isVerified,
        gymDetails: updatedOwner.gymDetails,
        subscriptionPlan: updatedOwner.subscriptionPlan,
        subscriptionExpiry: updatedOwner.subscriptionExpiry,
        createdAt: updatedOwner.createdAt,
        updatedAt: updatedOwner.updatedAt
      }
    });

  } catch (error) {
    console.error('❌ Error updating owner profile:', error);
    
    if (error.code === 11000) {
      let field = 'field';
      if (error.keyPattern?.email) field = 'email';
      if (error.keyPattern?.mobileNumber) field = 'mobile number';
      
      return res.status(409).json({
        success: false,
        message: `This ${field} is already in use by another account`
      });
    }

    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// NEW: Complete gym onboarding
// Fixed completeGymOnboarding function in ownerProfileController.js
const completeGymOnboarding = async (req, res) => {
  try {
    const { gymName, gymLogo } = req.body;
    const ownerId = req.user.id;

    console.log('🏋️ Completing gym onboarding for owner:', ownerId);
    console.log('📝 Received data:', { gymName, gymLogo: gymLogo ? 'Logo provided' : 'No logo' });

    // Validation
    if (!gymName || gymName.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Gym name must be at least 3 characters long'
      });
    }

    // Validate logo format if provided
    if (gymLogo && !gymLogo.startsWith('data:image/')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid logo format. Please upload a valid image.'
      });
    }

    // Find and update owner using findByIdAndUpdate for better reliability
    const updatedOwner = await Owner.findByIdAndUpdate(
      ownerId,
      {
        $set: {
          'gymDetails.gymName': gymName.trim(),
          'gymDetails.gymLogo': gymLogo || null,
          'gymDetails.isOnboardingComplete': true,
          'gymDetails.onboardingCompletedAt': new Date()
        }
      },
      { 
        new: true, // Return updated document
        runValidators: true,
        upsert: false // Don't create if doesn't exist
      }
    ).select('-password -otp -otpExpires');

    if (!updatedOwner) {
      console.log('❌ Owner not found for update');
      return res.status(404).json({
        success: false,
        message: 'Owner not found'
      });
    }

    console.log('💾 Updated gym details:', updatedOwner.gymDetails);

    // Verify the update was successful
    if (!updatedOwner.gymDetails.isOnboardingComplete) {
      console.log('❌ Onboarding completion flag not set properly');
      return res.status(500).json({
        success: false,
        message: 'Failed to complete onboarding setup'
      });
    }

    console.log('✅ Gym onboarding completed successfully');

    res.json({
      success: true,
      message: 'Gym setup completed successfully!',
      data: {
        gymName: updatedOwner.gymDetails.gymName,
        gymLogo: updatedOwner.gymDetails.gymLogo,
        isOnboardingComplete: updatedOwner.gymDetails.isOnboardingComplete,
        onboardingCompletedAt: updatedOwner.gymDetails.onboardingCompletedAt
      }
    });

  } catch (error) {
    console.error('❌ Error completing gym onboarding:', error);
    
    // Handle specific MongoDB errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid owner ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to complete gym setup',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};
// NEW: Check onboarding status
const getOnboardingStatus = async (req, res) => {
  try {
    const ownerId = req.user.id;
    
    const owner = await Owner.findById(ownerId).select('gymDetails firstName lastName');
    if (!owner) {
      return res.status(404).json({
        success: false,
        message: 'Owner not found'
      });
    }

    res.json({
      success: true,
      data: {
        needsOnboarding: owner.needsOnboarding(),
        gymDetails: owner.gymDetails,
        ownerName: `${owner.firstName} ${owner.lastName}`
      }
    });

  } catch (error) {
    console.error('❌ Error checking onboarding status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check onboarding status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

module.exports = {
  getOwnerProfile,
  updateOwnerProfile,
  completeGymOnboarding,
  getOnboardingStatus
};