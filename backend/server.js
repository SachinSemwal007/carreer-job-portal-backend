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
    if (educationalBackground)
      query.educationalBackground = educationalBackground;
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

// POST route: Add an applicant to a job post by ID
app.post("/api/posts/:id/apply", async (req, res) => {
  const { name, email, age, resume } = req.body;
  const postId = req.params.id;

  try {
    // Find the job post by ID
    const jobPost = await Post.findById(postId);
    if (!jobPost) {
      return res.status(404).json({ message: "Job post not found" });
    }

    // Create a new applicant object
    const newApplicant = {
      name,
      email,
      age,
      resume,
      applicationDate: new Date(),
    };

    // Add the new applicant to the job post's applicants array
    jobPost.applicants.push(newApplicant);

    // Save the updated job post
    await jobPost.save();

    res.status(201).json({ message: "Application submitted successfully!" });
  } catch (error) {
    console.error("Error applying for job:", error); // Add detailed error logging
    res.status(500).json({ message: "Internal server error", error: error.message });
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
    const applicantIndex = jobPost.applicants.findIndex(
      (applicant) => applicant.email === email
    );
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

// Sample Express.js endpoint to get applicant details

app.get('/api/applicant/details', async (req, res) => {
  // Extract the token from the 'Authorization' header
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization token is missing.' });
  }

  // Split the 'Bearer <token>' string and get the token part
  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Invalid token format.' });
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    const email = decoded.email;

    // Find the applicant by email
    const applicant = await Applicant.findOne({ email });
    if (!applicant) {
      return res.status(404).json({ message: 'Applicant not found.' });
    }

    // Return the applicant details
    res.status(200).json({
      name: applicant.name,
      email: applicant.email,
      age: applicant.age,
      resume: applicant.resume,
    });
  } catch (error) {
    console.error('Error verifying token or fetching applicant details:', error);
    res.status(400).json({ message: 'Invalid or expired token.' });
  }
});


// Applicant Signup route
app.post("/api/applicant/signup", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Check if applicant already exists
    const existingApplicant = await Applicant.findOne({ email });
    if (existingApplicant) {
      return res.status(400).json({ message: "Applicant already exists" });
    }

    // Generate a verification token
    const verificationToken = crypto.randomBytes(20).toString("hex");

    // Create a new applicant with the verification token
    const newApplicant = new Applicant({
      name,
      email,
      password,
      verificationToken,
    });
    await newApplicant.save();

    // Send verification email
    const verificationLink = `http://localhost:3000/verify?token=${verificationToken}`;
    const mailOptions = {
      from: EMAIL_USER,
      to: email,
      subject: "Applicant Email Verification",
      html: `<p>Please click the link below to verify your email:</p><a href="${verificationLink}">Verify Email</a>`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending verification email:", error);
        return res
          .status(500)
          .json({ message: "Error sending verification email." }); // Add this line
      } else {
        console.log("Verification email sent:", info.response);
      }
    });

    res
      .status(201)
      .json({
        message:
          "Applicant created successfully. Please verify your email to log in.",
      });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

// Applicant Login route
app.post("/api/applicant/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find applicant by email
    const applicant = await Applicant.findOne({ email });
    if (!applicant) {
      return res.status(400).json({ message: "Applicant not found" });
    }

    // Check if the email is verified by the absence of a verification token
    if (applicant.verificationToken) {
      return res
        .status(403)
        .json({ message: "Please verify your email to log in." });
    }

    // Check password
    const isPasswordValid = await applicant.matchPassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid password" });
    }

    // Generate a JWT token
    const token = jwt.sign({ email: applicant.email }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
