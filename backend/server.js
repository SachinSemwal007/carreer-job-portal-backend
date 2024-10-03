const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const User = require("./models/usermodel"); // Import the User model
const Post = require("./models/postmodel"); //import the Post model
const dotenv = require("dotenv");
const cors = require("cors");
const nodemailer = require("nodemailer");
const crypto = require("crypto"); // For generating the verification token
const Applicant = require("./models/applicantmodel"); // Adjust the path based on your project structure

// Load environment variables from .env file
dotenv.config();

// Import MongoDB URI and JWT secret from environment variables
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const EMAIL_USER = process.env.EMAIL_USER; // Email for nodemailer
const EMAIL_PASS = process.env.EMAIL_PASS; // Password for nodemailer

const app = express();
// Enable CORS globally
app.use(cors());
app.use(bodyParser.json()); // Parse JSON request bodies

// Create Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "Gmail", // e.g., Gmail, Outlook, SendGrid
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

// Connect to MongoDB
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Function to send verification email
const sendVerificationEmail = (applicantEmail, token) => {
  // Use the frontend URL where your Next.js application is hosted
  const verificationLink = `http://localhost:3000/email-verified/${token}`;

  const mailOptions = {
    from: EMAIL_USER,
    to: applicantEmail,
    subject: "Job Application Email Verification",
    html: `<p>Please click the link below to verify your email for the job application:</p> 
           <a href="${verificationLink}">Verify Email</a>`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending verification email:", error);
    } else {
      console.log("Verification email sent:", info.response);
    }
  });
};

// Sign Up route
app.post("/api/signup", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Create a new user
    const newUser = new User({ name, email, password });
    await newUser.save();

    res.status(201).json({ message: "User created successfully." });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

// Backend endpoint: /api/applicant/verify-email
app.get("/api/applicant/verify-email", async (req, res) => {
  const { token } = req.query;

  try {
    // Find applicant by the verification token
    const applicant = await Applicant.findOne({ verificationToken: token });
    if (!applicant) {
      return res
        .status(400)
        .json({ message: "Invalid or expired verification token." });
    }

    // Mark the applicant as verified
    applicant.verificationToken = undefined; // Clear the token
    await applicant.save();

    res.status(200).json({ message: "Email verified successfully!" });
  } catch (error) {
    console.error("Error during email verification:", error);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});

// Login route
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // Check password
    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid password" });
    }

    // Generate a JWT token
    const token = jwt.sign({ email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

// Protected route (example)
app.get("/api/protected", (req, res) => {
  const token = req.headers["authorization"];

  if (!token) {
    return res.status(401).json({ message: "Token is required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.status(200).json({ message: `Hello ${decoded.email}` });
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
});

app.post("/api/createpost", async (req, res) => {
  const {
    firstName,
    middleName,
    lastName,
    fhName,
    email,
    contact,
    whatsapp,
    gender,
    dob,
    maritalStatus,
    address,
    pincode,
    country,
    state,
    district,
    isHandicapped,
    community,
    matriculationYear,
    matriculationGrade,
    matriculationPercentage,
    matriculationBoard,
    interYear,
    interGrade,
    interPercentage,
    interBoard,
    bachelorYear,
    bachelorCourse,
    bachelorSpecialization,
    bachelorGrade,
    bachelorPercentage,
    bachelorUniversity,
    courses,
    experiences,
    references,
    achievement,
    description,
    passportPhoto,
    certification,
    signature,
    jobId, // Reference to Job model
  } = req.body;

  try {
    // Create a new job post with the data from the request
    const newPost = new Post({
      firstName,
      middleName,
      lastName,
      fhName,
      email,
      contact,
      whatsapp,
      gender,
      dob,
      maritalStatus,
      address,
      pincode,
      country,
      state,
      district,
      isHandicapped,
      community,
      matriculationYear,
      matriculationGrade,
      matriculationPercentage,
      matriculationBoard,
      interYear,
      interGrade,
      interPercentage,
      interBoard,
      bachelorYear,
      bachelorCourse,
      bachelorSpecialization,
      bachelorGrade,
      bachelorPercentage,
      bachelorUniversity,
      courses,
      experiences,
      references,
      achievement,
      description,
      passportPhoto,
      certification,
      signature,
      jobId,
    });

    // Save the new job post
    await newPost.save();

    res.status(201).json({ message: "Post created successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error on posting", error });
  }
});

// GET route: Retrieve all job posts with search, filter, pagination, and sorting
app.get("/api/posts", async (req, res) => {
  const {
    page = 1, 
    limit = 10,
    jobTitle, 
    experienceRequired, 
    educationalBackground,
    location,
    community,
    sort = "desc", // Sorting order for createdAt, default is descending
  } = req.query;

  try {
    // Convert `page` and `limit` to numbers
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);

    // Build a dynamic query object for filtering
    let query = {};

    // Add search filter for job title (case-insensitive)
    if (jobTitle) {
      query.jobTitle = { $regex: jobTitle, $options: "i" };
    }

    // Add filters for experience, educational background, location, and community if provided
    if (experienceRequired)
      query["experiences.jobType"] = {
        $regex: experienceRequired,
        $options: "i",
      };
    if (educationalBackground)
      query["bachelorCourse"] = {
        $regex: educationalBackground,
        $options: "i",
      };
    if (location) query.location = { $regex: location, $options: "i" };
    if (community) query.community = { $regex: community, $options: "i" };

    // Get the total number of posts that match the filters
    const totalPosts = await Post.countDocuments(query);

    // Calculate the number of posts to skip based on the current page
    const skip = (pageNumber - 1) * limitNumber;

    // Retrieve posts with search, filter, pagination, and sorting
    const jobPosts = await Post.find(query)
      .sort({ createdAt: sort === "asc" ? 1 : -1 }) // Sort by creation date (timestamps)
      .skip(skip)
      .limit(limitNumber);

    // Respond with the posts and pagination info
    res.status(200).json({
      jobPosts,
      totalPages: Math.ceil(totalPosts / limitNumber),
      currentPage: pageNumber,
      totalPosts,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching posts", error });
  }
});

// DELETE route: Delete a job post by ID
app.delete("/api/posts/:id", async (req, res) => {
  try {
    const deletedPost = await Post.findByIdAndDelete(req.params.id);

    if (!deletedPost) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.status(200).json({ message: "Post deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting post", error });
  }
});

// PUT route: Update a job post by ID
app.put("/api/posts/:id", async (req, res) => {
  const {
    companyName,
    jobTitle,
    skillsRequired,
    experienceRequired,
    educationalBackground,
    location,
    salary,
    jobDescription,
    postedDate,
  } = req.body;

  try {
    const updatedPost = await Post.findByIdAndUpdate(
      req.params.id,
      {
        companyName,
        jobTitle,
        skillsRequired,
        experienceRequired,
        educationalBackground,
        location,
        salary,
        jobDescription,
        postedDate,
      },
      { new: true } // Return the updated document
    );

    if (!updatedPost) {
      return res.status(404).json({ message: "Post not found" });
    }

    res
      .status(200)
      .json({ message: "Post updated successfully", post: updatedPost });
  } catch (error) {
    res.status(500).json({ message: "Error updating post", error });
  }
});

//Post route to apply for a job
app.post("/api/posts/:id/apply", async (req, res) => {
  const { applicationData, submitted } = req.body; // Expect `applicationData` and `submitted` status
  const postId = req.params.id;

  try {
    // Find the job post by ID
    const jobPost = await Post.findById(postId);
    if (!jobPost) {
      return res.status(404).json({ message: "Job post not found" });
    }

    // Ensure the `applicants` array exists
    if (!jobPost.applicants) {
      jobPost.applicants = [];
    }

    // Extract applicantId from applicationData
    const { applicantId } = applicationData;

    // Check if applicantId exists in the request
    if (!applicantId) {
      return res.status(400).json({ message: "Applicant ID is required in applicationData." });
    }

    // Find the applicant by their ID
    const applicant = await Applicant.findById(applicantId);
    if (!applicant) {
      return res.status(404).json({ message: "Applicant not found" });
    }

    // Ensure the `appliedPositions` array exists
    if (!applicant.appliedPositions) {
      applicant.appliedPositions = [];
    }

    // Create a new application object using the `appliedJob` schema format
    const newApplication = {
      ...applicationData, // Spread the application data from the frontend
      jobId: postId, // Associate with the job post
      submitted: !!submitted, // Ensure a boolean value is set
      applicationDate: new Date(), // Set the application date
      courses: applicationData.courses?.map(course => ({ name: course.name })) || [], // Default to an empty array if courses are not provided
      experiences: applicationData.experiences?.map(exp => ({
        title: exp.title,
        company: exp.company,
        years: exp.years,
      })) || [], // Default to an empty array if experiences are not provided
      references: applicationData.references?.map(ref => ({
        name: ref.name,
        relation: ref.relation,
        contact: ref.contact,
      })) || [], // Default to an empty array if references are not provided
    };

    // Validate and add the new application to the `applicants` array in `jobPost`
    jobPost.applicants.push(newApplication);

    // Save the updated job post document
    await jobPost.save();

    // Optionally, add the job application to the applicant's `appliedPositions` array
    applicant.appliedPositions.push({
      jobId: postId,
      applicationDate: newApplication.applicationDate, // Reusing the date to ensure consistency
    });
    await applicant.save();

    res.status(201).json({ message: "Application submitted successfully!" });
  } catch (error) {
    console.error("Error applying for job:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

//put route to edit a applied job
app.put("/api/posts/:postId/applications/:applicantId", async (req, res) => {
  const { postId, applicantId } = req.params; // Extract `postId` and `applicantId` from the URL
  const { applicationData, submitted } = req.body; // Get updated application data from the request body

  try {
    // Find the job post by ID
    const jobPost = await Post.findById(postId);
    if (!jobPost) {
      return res.status(404).json({ message: "Job post not found" });
    }

    // Ensure the `applicants` array exists
    if (!Array.isArray(jobPost.applicants)) {
      jobPost.applicants = [];
    }

    // Find the application to be edited within the job post's `applicants` array
    const applicationIndex = jobPost.applicants.findIndex(
      (app) => app.applicantId.toString() === applicantId
    );
    if (applicationIndex === -1) {
      return res.status(404).json({ message: "Application not found in job post" });
    }

    // Update the application fields
    const updatedApplication = {
      ...jobPost.applicants[applicationIndex], // Keep existing data
      ...applicationData, // Overwrite with the new data
      submitted: !!submitted, // Ensure `submitted` is a boolean
      applicationDate: new Date(), // Update the application date
      courses: applicationData.courses?.map((course) => ({
        name: course.name,
      })) || jobPost.applicants[applicationIndex].courses, // Preserve existing if not provided
      experiences: applicationData.experiences?.map((exp) => ({
        title: exp.title,
        company: exp.company,
        years: exp.years,
      })) || jobPost.applicants[applicationIndex].experiences, // Preserve existing if not provided
      references: applicationData.references?.map((ref) => ({
        name: ref.name,
        relation: ref.relation,
        contact: ref.contact,
      })) || jobPost.applicants[applicationIndex].references, // Preserve existing if not provided
    };

    // Replace the old application data with the updated one
    jobPost.applicants[applicationIndex] = updatedApplication;

    // Save the updated job post document
    await jobPost.save();

    // Optionally, update the applicant's `appliedPositions` array
    const applicant = await Applicant.findById(applicantId);
    if (applicant) {
      // Ensure the `appliedPositions` array exists
      if (!Array.isArray(applicant.appliedPositions)) {
        applicant.appliedPositions = [];
      }

      const applicantApplicationIndex = applicant.appliedPositions.findIndex(
        (app) => app.jobId.toString() === postId
      );
      if (applicantApplicationIndex !== -1) {
        applicant.appliedPositions[applicantApplicationIndex] = {
          jobId: postId,
          applicationDate: updatedApplication.applicationDate, // Set the updated application date
          submitted: !!submitted, // Include submitted status
        };
        await applicant.save();
      }
    }

    res.status(200).json({ message: "Application updated successfully!" });
  } catch (error) {
    console.error("Error updating application:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

// DELETE route: Remove an applicant from a job post
app.delete("/api/posts/:postId/applications/:applicantId", async (req, res) => {
  const { postId, applicantId } = req.params; // Extract `postId` and `applicantId` from the URL

  try {
    // Find the job post by ID
    const jobPost = await Post.findById(postId);
    if (!jobPost) {
      return res.status(404).json({ message: "Job post not found" });
    }

    // Ensure the `applicants` array exists
    if (!Array.isArray(jobPost.applicants)) {
      jobPost.applicants = [];
    }

    // Find the application to be deleted within the job post's `applicants` array
    const applicationIndex = jobPost.applicants.findIndex(
      (app) => app.applicantId.toString() === applicantId
    );
    if (applicationIndex === -1) {
      return res.status(404).json({ message: "Application not found in job post" });
    }

    // Remove the application from the `applicants` array
    jobPost.applicants.splice(applicationIndex, 1);

    // Save the updated job post document
    await jobPost.save();

    // Optionally, remove the job application from the applicant's `appliedPositions` array
    const applicant = await Applicant.findById(applicantId);
    if (applicant) {
      // Ensure the `appliedPositions` array exists
      if (!Array.isArray(applicant.appliedPositions)) {
        applicant.appliedPositions = [];
      }

      const applicantApplicationIndex = applicant.appliedPositions.findIndex(
        (app) => app.jobId.toString() === postId
      );
      if (applicantApplicationIndex !== -1) {
        applicant.appliedPositions.splice(applicantApplicationIndex, 1);
        await applicant.save();
      }
    }

    res.status(200).json({ message: "Application deleted successfully!" });
  } catch (error) {
    console.error("Error deleting application:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});



// Sample Express.js endpoint to get applicant details
app.get('/api/applicant/details', async (req, res) => {
  try {
    // Extract the token from the 'Authorization' header
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      console.log('Authorization header is missing');
      return res.status(401).json({ message: 'Authorization token is missing.' });
    }

    // Split the 'Bearer <token>' string and get the token part
    const token = authHeader.split(' ')[1];
    if (!token) {
      console.log('Invalid token format');
      return res.status(401).json({ message: 'Invalid token format.' });
    }

    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    const applicantId = decoded.id; // Ensure the token includes 'id'
    console.log('Decoded token:', decoded);

    // Find the applicant by their ID
    const applicant = await Applicant.findById(applicantId).populate('appliedPositions');
    if (!applicant) {
      console.log('Applicant not found for ID:', applicantId);
      return res.status(404).json({ message: 'Applicant not found.' });
    }

    // Return the applicant details
    res.status(200).json({
      name: applicant.name,
      email: applicant.email,
      appliedPositions: applicant.appliedPositions, // Include applied positions
    });
  } catch (error) {
    console.error('Error verifying token or fetching applicant details:', error);
    res.status(400).json({ message: 'Invalid or expired token.' });
  }
});


// Applicant Signup
app.post("/api/applicant/signup", async (req, res) => {
  const { name, email, password } = req.body;

  console.log("Received signup data:", req.body); // Log the received data

  try {
    // Check if the applicant already exists
    const existingApplicant = await Applicant.findOne({ email });
    if (existingApplicant) {
      console.log("Applicant already exists:", existingApplicant);
      return res.status(400).json({ message: "Applicant already exists" });
    }

    // Generate a verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // Create a new applicant
    const newApplicant = new Applicant({
      name,
      email,
      password,
      verificationToken,
    });

    // Log the applicant data before saving
    console.log("New applicant data before saving:", newApplicant);

    await newApplicant.save();

    // Send verification email
    const verificationLink = `http://localhost:3000/verify/${verificationToken}`;
    const mailOptions = {
      from: "pawsomeadoption620@gmail.com",
      to: email,
      subject: "Email Verification",
      text: `Please verify your email by clicking the following link: ${verificationLink}`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
        return res
          .status(500)
          .json({ message: "Error sending verification email." });
      }
      console.log("Verification email sent:", info.response);
      res.status(201).json({
        message:
          "Applicant created successfully. Please check your email to verify your account.",
      });
    });
  } catch (error) {
    console.error("Error during signup:", error); // Log the error for debugging
    if (error.name === "ValidationError") {
      // Log each validation error
      for (let field in error.errors) {
        console.error(
          `Validation error for ${field}:`,
          error.errors[field].message
        );
      }
      return res
        .status(400)
        .json({ message: "Validation error", errors: error.errors });
    }
    res.status(500).json({ message: "Server error", error });
  }
});

// Applicant Login route
app.post("/api/applicant/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user by email
    const user = await Applicant.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // Log the received password and stored hashed password
    console.log("Received password:", password);
    console.log("Stored hashed password:", user.password);

    // Compare passwords
    const isPasswordValid = await user.matchPassword(password);
    console.log("Password match result:", isPasswordValid); // Log the result of password comparison

    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid password" });
    }

    // Generate a JWT token
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });
    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.error("Server error during login:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await Applicant.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate a token
    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour expiration

    // Save the token to the user document
    await user.save();

    // Check if the token was successfully saved
    const updatedUser = await Applicant.findOne({ email });
    console.log("Updated User:", updatedUser);

    // Send email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "pawsomeadoption620@gmail.com",
        pass: "meyhuxsoqpjnbybv",
      },
    });

    const resetLink = `http://localhost:3000/reset-password/${token}`;
    const mailOptions = {
      to: user.email,
      from: "pawsomeadoption620@gmail.com",
      subject: "Password Reset",
      text: `You requested a password reset. Click this link to reset your password: ${resetLink}`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return res.status(500).json({ message: "Error sending email" });
      }
      res.status(200).json({ message: "Password reset email sent" });
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/reset-password/:token", async (req, res) => {
  const token = req.params.token.trim(); // Trim any leading/trailing spaces
  const { password: newPassword } = req.body;

  console.log("Received token:", token);
  console.log("New password before hashing:", newPassword);

  try {
    // Find the user with the matching resetPasswordToken and ensure the token has not expired
    const user = await Applicant.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }, // Token should not be expired
    });

    console.log("User found with token:", user);

    if (!user) {
      console.log("Token not found or expired");
      return res
        .status(400)
        .json({ message: "Password reset token is invalid or has expired." });
    }

    // Set the new password (hashing is handled via the pre('save') hook)
    user.password = newPassword;
    user.resetPasswordToken = undefined; // Clear reset token
    user.resetPasswordExpires = undefined; // Clear token expiration

    try {
      await user.save(); // Save the updated user object
      console.log("Password reset successful for user:", user.email);
      res
        .status(200)
        .json({ message: "Password has been successfully reset." });
    } catch (error) {
      console.error("Error updating password:", error.message);
      res
        .status(500)
        .json({ message: "Failed to reset password. Please try again later." });
    }
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Email Verification Route
app.get("/api/applicant/verify-email/:token", async (req, res) => {
  const { token } = req.params;

  try {
    // Find the applicant by the verification token
    const applicant = await Applicant.findOne({ verificationToken: token });
    if (!applicant) {
      return res.send(`
        <html>
        <body>
        <p>Invalid or expired verification token.</p>
        <script>
        setTimeout(() => {
          window.location.href = '/login';
          }, 3000); // Redirect to login page after 3 seconds
          </script>
          </body>
          </html>
          `);
    }

    // Mark the applicant as verified and clear the token
    applicant.verificationToken = undefined;
    await applicant.save();

    // Send an HTML response with a JavaScript redirect
    res.send(`
      <html>
      <body>
      <p>Email verified successfully! Redirecting to login...</p>
      <script>
      setTimeout(() => {
        window.location.href = '/login';
        }, 3000); // Redirect to login page after 3 seconds
        </script>
        </body>
        </html>
        `);
  } catch (error) {
    console.error("Error during email verification:", error);
    res.send(`
      <html>
      <body>
      <p>Server error. Please try again later.</p>
      <script>
      setTimeout(() => {
        window.location.href = '/login';
        }, 3000); // Redirect to login page after 3 seconds
        </script>
        </body>
        </html>
        `);
  } 
}); 

// Change Password Endpoint
app.post('/api/change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const token = req.headers['authorization'];

  if (!token) {
    console.error('No token provided');
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token.split(' ')[1], JWT_SECRET);
    const userId = decoded.id;

    // Find the user by ID
    const user = await Applicant.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Validate current password
    const isPasswordValid = await user.matchPassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash the new password before saving (assuming you have a method to hash passwords)
    user.password = await user.hashPassword(newPassword);
    await user.save();

    return res.status(200).json({ message: 'Password changed successfully.' });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.error('Token expired:', error);
      return res.status(401).json({ message: 'Token expired, please request a new token.' });
    }

    console.error('Error changing password:', error);
    return res.status(500).json({ message: 'Server error' });
  } 
}); 

 
// Refresh Token Route
app.post('/api/refresh-token', (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    console.error('No refresh token provided');
    return res.status(401).json({ message: 'Refresh token is required' });
  }

  try {
    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, JWT_SECRET); // Ensure this is the correct secret for refresh tokens

    // Optionally, verify the user exists in the database
    Applicant.findById(decoded.id, (err, user) => {
      if (err || !user) {
        console.error('User not found or error in database lookup:', err);
        return res.status(404).json({ message: 'User not found' });
      }

      // Generate a new access token
      const accessToken = jwt.sign({ id: decoded.id, email: decoded.email }, JWT_SECRET, {
        expiresIn: '15m', // New access token expiration time
      });

      return res.status(200).json({ accessToken });
    });

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.error('Refresh token expired:', error);
      return res.status(403).json({ message: 'Refresh token expired. Please log in again.' });
    } else if (error.name === 'JsonWebTokenError') {
      console.error('Invalid refresh token:', error);
      return res.status(403).json({ message: 'Invalid refresh token. Please log in again.' });
    } else {
      console.error('Error refreshing token:', error);
      return res.status(500).json({ message: 'Failed to refresh token. Please log in again.' });
    }
  }
});


 
const PORT = process.env.PORT || 5000; 
app.listen(PORT, () => { 
  console.log(`Server running on port ${PORT}`); 
}); 
