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

// Email verification route for applicants
app.get("/api/verify-applicant", async (req, res) => { 
  const { token } = req.query;

  try {
    // Verify the token and extract applicant data
    const decoded = jwt.verify(token, JWT_SECRET);
    const { name, email, resume, postId } = decoded;

    // Find the job post by ID
    const jobPost = await Post.findById(postId);
    if (!jobPost) {
      return res.status(404).json({ message: "Job post not found" });
    }

    // Step 1: Check if the applicants array is empty
    if (jobPost.applicants.length > 0) {
      // Step 2: Check if the applicant with the same email already exists
      const existingApplicant = jobPost.applicants.find(applicant => applicant.email === email);
      if (existingApplicant) {
        return res.status(400).json({ message: "Applicant has already been verified." });
      }
    }

    // Step 3: Add the new applicant to the applicants array
    const newApplicant = {
      name,
      email,
      resume,
      applicationDate: new Date()
    };
    jobPost.applicants.push(newApplicant);

    // Step 4: Save the updated job post
    await jobPost.save();

    res.status(200).json({ message: "Email verified successfully!" });
  } catch (error) {
    console.error("Verification error:", error);
    res.status(400).json({ message: "Invalid or expired token" });
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
  const { companyName, jobTitle, skillsRequired, experienceRequired, educationalBackground, location, salary, jobDescription, postedDate } = req.body;

  try {
    // Create new user
    const newPost = new Post({
      companyName,
      jobTitle,
      skillsRequired,
      experienceRequired,
      educationalBackground,
      location,
      salary,
      jobDescription,
      postedDate,
    });
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
    salary,
    sort = "desc", // Sorting order for postedDate, default is descending
  } = req.query;

  try {
    // Convert `page` and `limit` to numbers
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);

    // Build a dynamic query object for filtering
    let query = {};

    // Add search filter for job title (case-insensitive)
    if (jobTitle) {
      query.jobTitle = { $regex: jobTitle, $options: "i" }; // Case-insensitive search
    }

    // Add filters for experienceRequired, educationalBackground, location, and salary if provided
    if (experienceRequired) query.experienceRequired = experienceRequired;
    if (educationalBackground) query.educationalBackground = educationalBackground;
    if (location) query.location = location;
    if (salary) query.salary = salary;

    // Get the total number of posts that match the filters
    const totalPosts = await Post.countDocuments(query);

    // Calculate the number of posts to skip based on the current page
    const skip = (pageNumber - 1) * limitNumber;

    // Retrieve posts with search, filter, pagination, and sorting
    const jobPosts = await Post.find(query)
      .sort({ postedDate: sort === "asc" ? 1 : -1 }) // Sort by postedDate: ascending or descending
      .skip(skip) // Skip posts for the previous pages
      .limit(limitNumber); // Limit the number of posts per page

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
  const { companyName, jobTitle, skillsRequired, experienceRequired, educationalBackground, location, salary, jobDescription, postedDate } = req.body;

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

    res.status(200).json({ message: "Post updated successfully", post: updatedPost });
  } catch (error) {
    res.status(500).json({ message: "Error updating post", error });
  }
});

// POST route: Add an applicant to a job post by ID
app.post("/api/posts/:id/apply", async (req, res) => {
  const { name, email, resume } = req.body;
console.log(req.body)
  try {
    // Find the job post by ID
    const jobPost = await Post.findById(req.params.id);
    if (!jobPost) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Generate a verification token containing applicant data and job post ID
    const verificationToken = jwt.sign(
      { name, email, resume, postId: jobPost._id },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Send verification email to the applicant
    sendVerificationEmail(email, verificationToken);

    res.status(201).json({
      message: "Application submitted successfully. Please verify your email.",
    });
  } catch (error) {
    res.status(500).json({ message: "Error submitting application", error });
  }
});

// DELETE route: Remove an applicant from a job post
app.delete("/api/posts/:postId/applicants/:email", async (req, res) => {
  const { postId, email } = req.params;

  try {
    // Find the job post by ID
    const jobPost = await Post.findById(postId);
    if (!jobPost) {
      return res.status(404).json({ message: "Job post not found" });
    }

    // Find the index of the applicant to be removed
    const applicantIndex = jobPost.applicants.findIndex(applicant => applicant.email === email);
    if (applicantIndex === -1) {
      return res.status(404).json({ message: "Applicant not found" });
    }

    // Remove the applicant from the applicants array
    jobPost.applicants.splice(applicantIndex, 1);

    // Save the updated job post
    await jobPost.save();

    res.status(200).json({ message: "Applicant removed successfully." });
  } catch (error) {
    console.error("Error removing applicant:", error);
    res.status(500).json({ message: "Server error", error });
  }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});