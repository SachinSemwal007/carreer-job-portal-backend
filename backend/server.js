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
const fs = require("fs");
const { PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3"); // Assuming you are using AWS SDK v3
const s3Client = require("./s3Client"); // Your configured S3 client
const upload = require("./uploadMiddleware");

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
    html: `<p>Thank you for applying at JSSPS. To complete your application, please verify your email address by clicking on the below link:  
           If you did not apply for this position, please disregard this email.  
           Should you encounter any issues, feel free to contact us at jsspscareers@gmail.com.  
           We look forward to reviewing your application. </p>  
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

// POST route: Create a new job post
app.post("/api/createpost", async (req, res) => {
  const {
    jobTitle,
    skillsRequired,
    experienceRequired,
    educationalBackground,
    location,
    salary,
    jobDescription,
  } = req.body;

  try {
    // Create a new job post with the data from the request
    const newPost = new Post({
      jobTitle,
      skillsRequired,
      experienceRequired,
      educationalBackground,
      location,
      salary,
      jobDescription,
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
      query.jobTitle = { $regex: jobTitle, $options: "i" };
    }

    // Add filters for experience, educational background, and location if provided
    if (experienceRequired) {
      query.experienceRequired = { $regex: experienceRequired, $options: "i" };
    }
    if (educationalBackground) {
      query.educationalBackground = {
        $regex: educationalBackground,
        $options: "i",
      };
    }
    if (location) {
      query.location = { $regex: location, $options: "i" };
    }

    // Get the total number of posts that match the filters
    const totalPosts = await Post.countDocuments(query);

    // Calculate the number of posts to skip based on the current page
    const skip = (pageNumber - 1) * limitNumber;

    // Retrieve posts with search, filter, pagination, and sorting
    const jobPosts = await Post.find(query)
      .sort({ postedDate: sort === "asc" ? 1 : -1 }) // Sort by postedDate
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
    jobTitle,
    skillsRequired,
    experienceRequired,
    educationalBackground,
    location,
    salary,
    jobDescription,
  } = req.body;

  try {
    const updatedPost = await Post.findByIdAndUpdate(
      req.params.id,
      {
        jobTitle,
        skillsRequired,
        experienceRequired,
        educationalBackground,
        location,
        salary,
        jobDescription,
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

app.post(
  "/api/posts/:id/apply",
  upload.fields([
    { name: "passportPhoto", maxCount: 1 },
    { name: "certification", maxCount: 1 },
    { name: "signature", maxCount: 1 },
  ]),
  async (req, res) => {
    const session = await mongoose.startSession(); // Start a session for transactions
    session.startTransaction(); // Begin transaction

    try {
      const postId = req.params.id;
      const files = req.files;

      // Parse applicationData from the request body
      const applicationData = JSON.parse(req.body.applicationData);
      const { submitted } = req.body;

      // Find the job post by ID
      const jobPost = await Post.findById(postId).session(session);
      if (!jobPost) {
        return res.status(404).json({ message: "Job post not found" });
      }

      // Generate a padded applicationId using the existing applicationData.applicationId
      const sportCodes = {
        boxing: "BX",
        athletics: "ATH",
        swimming: "SW",
        football: "FB",
        archery: "ARC",
        weightlifting: "WL",
        shooting: "SH",
        cycling: "CY",
        wrestling: "WR",
        taekwondo: "TKD",
        gymnastics: "GYM",
        tableTennis: "TT",
        lawnTennis: "LT",
        badminton: "BD",
        wushu: "WS",
      };

      // Fetch the sport from applicationData
      const sport = applicationData.sport;

      // Get the sport code using the sport name
      const sportCode = sportCodes[sport];

      // Define the base application ID with job position (e.g., "CO")
      const baseApplicationId = applicationData.applicationId;

      // Get the next index and pad it to 4 digits
      const nextIndex = jobPost.applicants.length + 1;
      const paddedIndex = nextIndex.toString().padStart(4, "0");

      // Create the new application ID using the job position, sport code, and index
      const newApplicationId = `${baseApplicationId}-${sportCode}-${paddedIndex}`; // Append the padded index to the base string

      // console.log(newApplicationId);
      // Check if all required fields are present

      const {
        applicantId,
        firstName,
        lastName,
        email,
        contact,
        courses,
        experiences,
        references,
      } = applicationData;

      if (!applicantId || !firstName || !lastName || !email || !contact) {
        return res.status(400).json({
          message:
            "All required fields (applicantId, firstName, lastName, email, contact) must be provided.",
        });
      }

      // Find the applicant by their ID
      const applicant = await Applicant.findById(applicantId).session(session);
      if (!applicant) {
        return res.status(404).json({ message: "Applicant not found" });
      }

      // Upload files to S3 (if any) and obtain URLs
      const uploadToS3 = async (file) => {
        const fileContent = fs.readFileSync(file.path);
        const params = {
          Bucket: process.env.S3_BUCKET_NAME,
          Key: `${Date.now()}_${file.originalname}`,
          Body: fileContent,
          ContentType: file.mimetype,
        };
        await s3Client.send(new PutObjectCommand(params));
        return `https://${params.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.Key}`;
      };

       function formatString(input) {
         // Insert space before each capital letter except the first one
         const formattedString = input.replace(/([A-Z])/g, " $1").trim();

         // Capitalize the first letter of the first word
         return (
           formattedString.charAt(0).toUpperCase() + formattedString.slice(1)
         );
       }

      let passportPhotoUrl = "",
        certificationUrl = "",
        signatureUrl = "";
      if (files.passportPhoto) {
        passportPhotoUrl = await uploadToS3(files.passportPhoto[0]);
      }
      if (files.certification) {
        certificationUrl = await uploadToS3(files.certification[0]);
      }
      if (files.signature) {
        signatureUrl = await uploadToS3(files.signature[0]);
      }

      // Create the new application object for the job post
      const newApplicationForJob = {
        applicationId: newApplicationId, // Ensure applicationId is set here
        applicantId,
        sport:applicationData.sport,
        firstName,
        middleName: applicationData.middleName,
        lastName,
        fhName: applicationData.fhName,
        email,
        contact,
        whatsapp: applicationData.whatsapp,
        gender: applicationData.gender,
        dob: applicationData.dob,
        maritalStatus: applicationData.maritalStatus,
        address: applicationData.address,
        pincode: applicationData.pincode,
        country: applicationData.country,
        state: applicationData.state,
        district: applicationData.district,
        isHandicapped: applicationData.isHandicapped,
        community: applicationData.community,
        matriculationYear: applicationData.matriculationYear,
        matriculationGrade: applicationData.matriculationGrade,
        matriculationPercentage: applicationData.matriculationPercentage,
        matriculationBoard: applicationData.matriculationBoard,
        interYear: applicationData.interYear,
        interGrade: applicationData.interGrade,
        interPercentage: applicationData.interPercentage,
        interBoard: applicationData.interBoard,
        bachelorYear: applicationData.bachelorYear,
        bachelorCourse: applicationData.bachelorCourse,
        bachelorSpecialization: applicationData.bachelorSpecialization,
        bachelorGrade: applicationData.bachelorGrade,
        bachelorPercentage: applicationData.bachelorPercentage,
        bachelorUniversity: applicationData.bachelorUniversity,
        masterYear: applicationData.masterYear,
        masterCourse: applicationData.masterCourse,
        masterSpecialization: applicationData.masterSpecialization,
        masterGrade: applicationData.masterGrade,
        masterPercentage: applicationData.masterPercentage,
        masterUniversity: applicationData.masterUniversity,
        courses: courses ? courses.map((course) => ({ ...course })) : [],
        experiences: experiences ? experiences.map((exp) => ({ ...exp })) : [],
        references: references ? references.map((ref) => ({ ...ref })) : [],
        achievement: applicationData.achievement,
        description: applicationData.description,
        passportPhoto: passportPhotoUrl,
        certification: certificationUrl,
        signature: signatureUrl,
        submitted: applicationData.submitted,
        jobId: postId,
      };

      // Add the new application to the job post's `applicants` array
      jobPost.applicants.push(newApplicationForJob);
      await jobPost.save({ session });

      // Create the new application object for the applicant's `appliedPositions`
      const newApplicationForApplicant = {
        applicationId: newApplicationId, // Ensure applicationId is set here as well
        postId,
        applicantId,
        firstName,
        middleName: applicationData.middleName,
        sport: applicationData.sport,
        lastName,
        fhName: applicationData.fhName,
        email,
        contact,
        whatsapp: applicationData.whatsapp,
        gender: applicationData.gender,
        dob: applicationData.dob,
        maritalStatus: applicationData.maritalStatus,
        address: applicationData.address,
        pincode: applicationData.pincode,
        country: applicationData.country,
        state: applicationData.state,
        district: applicationData.district,
        isHandicapped: applicationData.isHandicapped,
        community: applicationData.community,
        matriculationYear: applicationData.matriculationYear,
        matriculationGrade: applicationData.matriculationGrade,
        matriculationPercentage: applicationData.matriculationPercentage,
        matriculationBoard: applicationData.matriculationBoard,
        interYear: applicationData.interYear,
        interGrade: applicationData.interGrade,
        interPercentage: applicationData.interPercentage,
        interBoard: applicationData.interBoard,
        bachelorYear: applicationData.bachelorYear,
        bachelorCourse: applicationData.bachelorCourse,
        bachelorSpecialization: applicationData.bachelorSpecialization,
        bachelorGrade: applicationData.bachelorGrade,
        bachelorPercentage: applicationData.bachelorPercentage,
        bachelorUniversity: applicationData.bachelorUniversity,
        masterYear: applicationData.masterYear,
        masterCourse: applicationData.masterCourse,
        masterSpecialization: applicationData.masterSpecialization,
        masterGrade: applicationData.masterGrade,
        masterPercentage: applicationData.masterPercentage,
        masterUniversity: applicationData.masterUniversity,
        courses: courses ? courses.map((course) => ({ ...course })) : [],
        experiences: experiences ? experiences.map((exp) => ({ ...exp })) : [],
        references: references ? references.map((ref) => ({ ...ref })) : [],
        achievement: applicationData.achievement,
        description: applicationData.description,
        passportPhoto: passportPhotoUrl,
        certification: certificationUrl,
        signature: signatureUrl,
        submitted: applicationData.submitted,
        jobId: postId,
      };

      // Add the application to the applicant's `appliedPositions`
      applicant.appliedPositions.push(newApplicationForApplicant);
      await applicant.save({ session });

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      res.status(201).json({ message: "Application submitted successfully!" });
    } catch (error) {
      // Rollback transaction in case of error
      await session.abortTransaction();
      session.endSession();

      console.error("Error applying for job:", error);
      res
        .status(500)
        .json({ message: "Internal server error", error: error.message });
    } finally {
      // Clean up local files
      if (req.files) {
        Object.values(req.files)
          .flat()
          .forEach((file) => fs.unlinkSync(file.path));
      }
    }
  }
);

//put route to edit a applied job

app.put(
  "/api/applicants/application/:applicationId",
  upload.fields([
    { name: "passportPhoto", maxCount: 1 },
    { name: "certification", maxCount: 1 },
    { name: "signature", maxCount: 1 },
  ]),
  async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { applicationId } = req.params;
      const { jobId } = req.body; // Assuming `jobId` is provided in the request body
      const files = req.files;

      if (!jobId) {
        return res.status(400).json({ message: "jobId is required" });
      }
      const uploadToS3 = async (file) => {
        const fileContent = fs.readFileSync(file.path);
        const params = {
          Bucket: process.env.S3_BUCKET_NAME,
          Key: `${Date.now()}_${file.originalname}`,
          Body: fileContent,
          ContentType: file.mimetype,
        };
        await s3Client.send(new PutObjectCommand(params));
        return `https://${params.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.Key}`;
      };

      const updatedData = JSON.parse(req.body.applicationData);

      // Upload new files to S3 (if any) and obtain URLs
      let passportPhotoUrl = "",
        certificationUrl = "",
        signatureUrl = "";
      if (files.passportPhoto) {
        passportPhotoUrl = await uploadToS3(files.passportPhoto[0]);
      }
      if (files.certification) {
        certificationUrl = await uploadToS3(files.certification[0]);
      }
      if (files.signature) {
        signatureUrl = await uploadToS3(files.signature[0]);
      }

      // Update Applicant's appliedPositions array using applicationId
      const updateApplicant = {
        $set: {
          "appliedPositions.$[elem].applicationId": updatedData.applicationId, // Missing applicationId
          "appliedPositions.$[elem].firstName": updatedData.firstName,
          "appliedPositions.$[elem].middleName": updatedData.middleName,
          "appliedPositions.$[elem].lastName": updatedData.lastName,
          "appliedPositions.$[elem].sport": updatedData.sport,
          "appliedPositions.$[elem].fhName": updatedData.fhName,
          "appliedPositions.$[elem].email": updatedData.email,
          "appliedPositions.$[elem].contact": updatedData.contact,
          "appliedPositions.$[elem].whatsapp": updatedData.whatsapp,
          "appliedPositions.$[elem].gender": updatedData.gender,
          "appliedPositions.$[elem].dob": updatedData.dob,
          "appliedPositions.$[elem].maritalStatus": updatedData.maritalStatus,
          "appliedPositions.$[elem].address": updatedData.address,
          "appliedPositions.$[elem].pincode": updatedData.pincode,
          "appliedPositions.$[elem].country": updatedData.country,
          "appliedPositions.$[elem].state": updatedData.state,
          "appliedPositions.$[elem].district": updatedData.district,
          "appliedPositions.$[elem].isHandicapped": updatedData.isHandicapped,
          "appliedPositions.$[elem].community": updatedData.community,
          "appliedPositions.$[elem].matriculationYear":
            updatedData.matriculationYear,
          "appliedPositions.$[elem].matriculationGrade":
            updatedData.matriculationGrade,
          "appliedPositions.$[elem].matriculationPercentage":
            updatedData.matriculationPercentage,
          "appliedPositions.$[elem].matriculationBoard":
            updatedData.matriculationBoard,
          "appliedPositions.$[elem].interYear": updatedData.interYear,
          "appliedPositions.$[elem].interGrade": updatedData.interGrade,
          "appliedPositions.$[elem].interPercentage":
            updatedData.interPercentage,
          "appliedPositions.$[elem].interBoard": updatedData.interBoard,
          "appliedPositions.$[elem].bachelorYear": updatedData.bachelorYear,
          "appliedPositions.$[elem].bachelorCourse": updatedData.bachelorCourse,
          "appliedPositions.$[elem].bachelorSpecialization":
            updatedData.bachelorSpecialization,
          "appliedPositions.$[elem].bachelorGrade": updatedData.bachelorGrade,
          "appliedPositions.$[elem].bachelorPercentage":
            updatedData.bachelorPercentage,
          "appliedPositions.$[elem].masterYear": updatedData.masterYear,
          "appliedPositions.$[elem].masterCourse": updatedData.masterCourse,
          "appliedPositions.$[elem].masterSpecialization":
            updatedData.masterSpecialization,
          "appliedPositions.$[elem].masterGrade": updatedData.masterGrade,
          "appliedPositions.$[elem].masterPercentage":
            updatedData.masterPercentage,
          "appliedPositions.$[elem].masterUniversity":
            updatedData.masterUniversity,
          "appliedPositions.$[elem].passportPhoto":
            passportPhotoUrl || updatedData.passportPhoto,
          "appliedPositions.$[elem].certification":
            certificationUrl || updatedData.certification,
          "appliedPositions.$[elem].signature":
            signatureUrl || updatedData.signature,
          "appliedPositions.$[elem].courses": updatedData.courses,
          "appliedPositions.$[elem].experiences": updatedData.experiences,
          "appliedPositions.$[elem].references": updatedData.references,
          "appliedPositions.$[elem].achievement": updatedData.achievement,
          "appliedPositions.$[elem].description": updatedData.description,
          "appliedPositions.$[elem].submitted": updatedData.submitted, // Missing submitted field
        },
      };

      // Update JobPost's applicants array using applicationId
      const updateJobPost = {
        $set: {
          "applicants.$[elem].applicationId": updatedData.applicationId, // Added missing field
          "applicants.$[elem].firstName": updatedData.firstName,
          "applicants.$[elem].middleName": updatedData.middleName,
          "applicants.$[elem].lastName": updatedData.lastName,
          "applicants.$[elem].fhName": updatedData.fhName,
          "appliedPositions.$[elem].sport": updatedData.sport,
          "applicants.$[elem].email": updatedData.email,
          "applicants.$[elem].contact": updatedData.contact,
          "applicants.$[elem].whatsapp": updatedData.whatsapp,
          "applicants.$[elem].gender": updatedData.gender,
          "applicants.$[elem].dob": updatedData.dob,
          "applicants.$[elem].maritalStatus": updatedData.maritalStatus,
          "applicants.$[elem].address": updatedData.address,
          "applicants.$[elem].pincode": updatedData.pincode,
          "applicants.$[elem].country": updatedData.country,
          "applicants.$[elem].state": updatedData.state,
          "applicants.$[elem].district": updatedData.district,
          "applicants.$[elem].isHandicapped": updatedData.isHandicapped,
          "applicants.$[elem].community": updatedData.community,
          "applicants.$[elem].matriculationYear": updatedData.matriculationYear,
          "applicants.$[elem].matriculationGrade":
            updatedData.matriculationGrade,
          "applicants.$[elem].matriculationPercentage":
            updatedData.matriculationPercentage,
          "applicants.$[elem].matriculationBoard":
            updatedData.matriculationBoard,
          "applicants.$[elem].interYear": updatedData.interYear,
          "applicants.$[elem].interGrade": updatedData.interGrade,
          "applicants.$[elem].interPercentage": updatedData.interPercentage,
          "applicants.$[elem].interBoard": updatedData.interBoard,
          "applicants.$[elem].bachelorYear": updatedData.bachelorYear,
          "applicants.$[elem].bachelorCourse": updatedData.bachelorCourse,
          "applicants.$[elem].bachelorSpecialization":
            updatedData.bachelorSpecialization,
          "applicants.$[elem].bachelorGrade": updatedData.bachelorGrade,
          "applicants.$[elem].bachelorPercentage":
            updatedData.bachelorPercentage,
          "applicants.$[elem].bachelorUniversity":
            updatedData.bachelorUniversity,
          "applicants.$[elem].passportPhoto":
            passportPhotoUrl || updatedData.passportPhoto,
          "applicants.$[elem].certification":
            certificationUrl || updatedData.certification,
          "applicants.$[elem].signature": signatureUrl || updatedData.signature,
          "applicants.$[elem].courses": updatedData.courses,
          "applicants.$[elem].experiences": updatedData.experiences,
          "applicants.$[elem].references": updatedData.references,
          "applicants.$[elem].achievement": updatedData.achievement,
          "applicants.$[elem].description": updatedData.description,
          "applicants.$[elem].submitted": updatedData.submitted, // Added missing submitted field
        },
      };

      // Update Applicant
      await Applicant.updateOne(
        { "appliedPositions.applicationId": applicationId },
        updateApplicant,
        {
          arrayFilters: [{ "elem.applicationId": applicationId }],
          session: session,
        }
      );

      // Update JobPost
      await Post.updateOne(
        { "applicants.applicationId": applicationId },
        updateJobPost,
        {
          arrayFilters: [{ "elem.applicationId": applicationId }],
          session: session,
        }
      );

      // Commit transaction
      await session.commitTransaction();
      session.endSession();

      res
        .status(200)
        .json({ message: "Applicant and Job post updated successfully" });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();

      console.error("Error updating applicant and job post:", error);
      res
        .status(500)
        .json({ message: "Internal server error", error: error.message });
    } finally {
      if (req.files) {
        Object.values(req.files)
          .flat()
          .forEach((file) => fs.unlinkSync(file.path));
      }
    }
  }
);

// DELETE route: Remove an applicant from a job post
app.delete(
  "/api/posts/:postId/applications/:applicationId",
  async (req, res) => {
    const { postId, applicationId } = req.params;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find the job post by ID
      const jobPost = await Post.findById(postId).session(session);
      if (!jobPost) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: "Job post not found" });
      }

      // Find the application to be deleted by its _id (applicationId)
      const applicationIndex = jobPost.applicants.findIndex(
        (app) => app._id.toString() === applicationId
      );
      if (applicationIndex === -1) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(404)
          .json({ message: "Application not found in job post" });
      }

      // Helper function to delete from S3
      const deleteFromS3 = async (url) => {
        if (!url) return;
        const key = url.split("/").pop();
        const params = {
          Bucket: process.env.S3_BUCKET_NAME,
          Key: key,
        };
        await s3Client.send(new DeleteObjectCommand(params));
      };

      // Delete associated files from S3
      const application = jobPost.applicants[applicationIndex];
      if (application.passportPhoto)
        await deleteFromS3(application.passportPhoto);
      if (application.certification)
        await deleteFromS3(application.certification);
      if (application.signature) await deleteFromS3(application.signature);

      // Remove the application from the `applicants` array
      jobPost.applicants.splice(applicationIndex, 1);

      // Save the updated job post document
      await jobPost.save({ session });

      // Optionally, remove the job application from the applicant's `appliedPositions` array
      const applicant = await Applicant.findOne({
        _id: application.applicantId,
      }).session(session);
      if (applicant) {
        const applicantApplicationIndex = applicant.appliedPositions.findIndex(
          (app) => app.jobId.toString() === postId
        );
        if (applicantApplicationIndex !== -1) {
          applicant.appliedPositions.splice(applicantApplicationIndex, 1);
          await applicant.save({ session });
        }
      }

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({ message: "Application deleted successfully!" });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();

      console.error("Error deleting application:", error);
      res
        .status(500)
        .json({ message: "Internal server error", error: error.message });
    }
  }
);

// Sample Express.js endpoint to get applicant details
app.get("/api/applicant/details", async (req, res) => {
  try {
    // Extract the token from the 'Authorization' header
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      console.log("Authorization header is missing");
      return res
        .status(401)
        .json({ message: "Authorization token is missing." });
    }

    // Split the 'Bearer <token>' string and get the token part
    const token = authHeader.split(" ")[1];
    if (!token) {
      console.log("Invalid token format");
      return res.status(401).json({ message: "Invalid token format." });
    }

    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    const applicantId = decoded.id; // Ensure the token includes 'id'
    // console.log("Decoded token:", decoded);

    // Find the applicant by their ID
    const applicant = await Applicant.findById(applicantId).populate(
      "appliedPositions"
    );
    if (!applicant) {
      console.log("Applicant not found for ID:", applicantId);
      return res.status(404).json({ message: "Applicant not found." });
    }

    // Return the applicant details
    res.status(200).json({
      name: applicant.name,
      email: applicant.email,
      appliedPositions: applicant.appliedPositions,
      id: applicant.id, // Include applied positions
    });
  } catch (error) {
    console.error(
      "Error verifying token or fetching applicant details:",
      error
    );
    res.status(400).json({ message: "Invalid or expired token." });
  }
});

// Applicant Signup
app.post("/api/applicant/signup", async (req, res) => {
  const { name, email, password } = req.body;

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
    // console.log("New applicant data before saving:", newApplicant);

    await newApplicant.save();

    // Send verification email
    const verificationLink = `http://localhost:3000/verify/${verificationToken}`;
    const mailOptions = {
      from: "jsspscareers@gmail.com",
      to: email,
      subject: "Email Verification",
      text: `Thank you for applying at JSSPS. To complete your application, please verify your email address by clicking on the below link:  
           ${verificationLink}
           If you did not apply for this position, please disregard this email.  
           Should you encounter any issues, feel free to contact us at jsspscareers@gmail.com.  
           We look forward to reviewing your application.`,
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
    // console.log("Received password:", password);
    // console.log("Stored hashed password:", user.password);

    // Compare passwords
    const isPasswordValid = await user.matchPassword(password);
    // console.log("Password match result:", isPasswordValid); // Log the result of password comparison

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
    // console.log("Updated User:", updatedUser);

    // Send email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "jsspscareers@gmail.com",
        pass: "nwnhyoosodivrkce",
      },
    });

    const resetLink = `http://localhost:3000/reset-password/${token}`;
    const mailOptions = {
      to: user.email,
      from: "jsspscareers@gmail.com",
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

  // console.log("Received token:", token);
  // console.log("New password before hashing:", newPassword);

  try {
    // Find the user with the matching resetPasswordToken and ensure the token has not expired
    const user = await Applicant.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }, // Token should not be expired
    });

    // console.log("User found with token:", user);

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
app.post("/api/change-password", async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const token = req.headers["authorization"];

  if (!token) {
    console.error("No token provided");
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token.split(" ")[1], JWT_SECRET);
    const userId = decoded.id;

    // Find the user by ID
    const user = await Applicant.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Validate current password
    const isPasswordValid = await user.matchPassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Hash the new password before saving (assuming you have a method to hash passwords)
    user.password = await user.hashPassword(newPassword);
    await user.save();

    return res.status(200).json({ message: "Password changed successfully." });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      console.error("Token expired:", error);
      return res
        .status(401)
        .json({ message: "Token expired, please request a new token." });
    }

    console.error("Error changing password:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// Refresh Token Route
app.post("/api/refresh-token", (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    console.error("No refresh token provided");
    return res.status(401).json({ message: "Refresh token is required" });
  }

  try {
    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, JWT_SECRET); // Ensure this is the correct secret for refresh tokens

    // Optionally, verify the user exists in the database
    Applicant.findById(decoded.id, (err, user) => {
      if (err || !user) {
        console.error("User not found or error in database lookup:", err);
        return res.status(404).json({ message: "User not found" });
      }

      // Generate a new access token
      const accessToken = jwt.sign(
        { id: decoded.id, email: decoded.email },
        JWT_SECRET,
        {
          expiresIn: "15m", // New access token expiration time
        }
      );

      return res.status(200).json({ accessToken });
    });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      console.error("Refresh token expired:", error);
      return res
        .status(403)
        .json({ message: "Refresh token expired. Please log in again." });
    } else if (error.name === "JsonWebTokenError") {
      console.error("Invalid refresh token:", error);
      return res
        .status(403)
        .json({ message: "Invalid refresh token. Please log in again." });
    } else {
      console.error("Error refreshing token:", error);
      return res
        .status(500)
        .json({ message: "Failed to refresh token. Please log in again." });
    }
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

