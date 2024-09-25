const mongoose = require('mongoose');


const applicantSchema = new mongoose.Schema({
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    resume: {
      type: String, // URL to the applicant's resume or CV
      required: true,
    },
    applicationDate: {
      type: Date,
      default: Date.now, // Automatically set the current date when the application is submitted
    }
  });

// Define the Job Post schema
const postSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true,
  },
  jobTitle: {
    type: String,
    required: true,
  },
  skillsRequired: {
    type: [String], // Array of skills
    required: true,
  },
  experienceRequired: {
    type: String, // Example: "2-4 years", or "Entry level"
    required: true,
  },
  educationalBackground: {
    type: String, // Example: "Bachelor's in Computer Science"
    required: true,
  },
  location: {
    type: String, // Job location
    required: true,
  },
  salary: {
    type: String, // Example: "$50k - $80k", or "Negotiable"
    required: false,
  },
  jobDescription: {
    type: String, // Detailed job description
    required: true,
  },
  postedDate: {
    type: Date,
    default: Date.now, // Automatically add the current date when posting
  },
  applicants: [applicantSchema], // Array to store applicant details

});

// Create the Job Post model
const JobPost = mongoose.model('JobPost', postSchema);

module.exports = JobPost;
