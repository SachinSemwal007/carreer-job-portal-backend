const mongoose = require('mongoose');
const {Schema}=mongoose

const courseSchema = new Schema({
  name: { type: String, required: true },
});

const experienceSchema = new Schema({
  title: { type: String, required: true },
  company: { type: String, required: true },
  years: { type: Number, required: true },
});

const referenceSchema = new Schema({
  name: { type: String, required: true },
  relation: { type: String, required: true },
  contact: { type: String, required: true },
});

// Main Post schema
const appliedJob = new Schema({
  applicantId: { type: String, required: true }, 
  firstName: { type: String, required: true },
  middleName: { type: String },
  lastName: { type: String, required: true },
  fhName: { type: String },
  email: { type: String, required: true },
  contact: { type: String, required: true },
  whatsapp: { type: String },
  gender: { type: String },
  dob: { type: Date },
  maritalStatus: { type: String },
  address: { type: String },
  pincode: { type: String },
  country: { type: String },
  state: { type: String },
  district: { type: String },
  isHandicapped: { type: Boolean, default: false },
  community: { type: String },
  matriculationYear: { type: Number },
  matriculationGrade: { type: String },
  matriculationPercentage: { type: Number },
  matriculationBoard: { type: String },
  interYear: { type: Number },
  interGrade: { type: String },
  interPercentage: { type: Number },
  interBoard: { type: String },
  bachelorYear: { type: Number },
  bachelorCourse: { type: String },
  bachelorSpecialization: { type: String },
  bachelorGrade: { type: String },
  bachelorPercentage: { type: Number },
  bachelorUniversity: { type: String },
  courses: [courseSchema], // Array of embedded course documents
  experiences: [experienceSchema], // Array of embedded experience documents
  references: [referenceSchema], // Array of embedded reference documents
  achievement: { type: String },
  description: { type: String },
  passportPhoto: { type: String }, // Assuming this is a URL or file path
  certification: { type: String }, // Assuming this is a URL or file path
  signature: { type: String }, // Assuming this is a URL or file path
  submitted:{type:Boolean},
  jobId: { type: Schema.Types.ObjectId, ref: "Job" }, // Reference to Job model
});

// Define the Job Post schema
const postSchema = new mongoose.Schema({
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
  applicants: [appliedJob], // Array to store applicant details

});

// Create the Job Post model
const Post = mongoose.model('JobPost', postSchema);

module.exports = Post;
