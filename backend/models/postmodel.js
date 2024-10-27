const mongoose = require('mongoose');  
const {Schema}=mongoose  
  
// Main Post schema  
const appliedJob = new Schema({ 
  applicationId: { type: String, required: false }, 
  sport: { type: String, required: false }, 
  applicantId: { type: String, required: false }, 
  firstName: { type: String, required: false }, 
  middleName: { type: String }, 
  lastName: { type: String, required: false }, 
  fhName: { type: String }, 
  email: { type: String, required: false }, 
  contact: { type: String, required: false }, 
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
  masterYear: { type: Number }, 
  masterCourse: { type: String }, 
  masterSpecialization: { type: String }, 
  masterGrade: { type: String }, 
  masterPercentage: { type: Number }, 
  masterUniversity: { type: String }, 
  courses: [ 
    { 
      name: { type: String, required: false }, 
      specialSubject: { type: String }, // Missing in original schema 
      yearOfPassing: { type: Number }, // Missing in original schema 
      duration: { type: String }, // Missing in original schema 
      gradeDivision: { type: String }, // Missing in original schema 
      percent: { type: Number }, // Missing in original schema 
      instituteName: { type: String }, // Missing in original schema 
    }, 
  ], // Array of embedded course documents 
  experiences: [ 
    { 
      title: { type: String, required: false }, 
      company: { type: String, required: false }, 
      years: { type: Number, required: false }, 
      post: { type: String }, // Missing in original schema 
      jobType: { type: String }, // Missing in original schema 
      fromDate: { type: Date }, // Missing in original schema 
      tillDate: { type: Date }, // Missing in original schema 
      scaleOfType: { type: String }, // Missing in original schema 
      natureOfDuties: { type: String }, // Missing in original schema 
    }, 
  ], // Array of embedded experience documents 
  references: [ 
    { 
      name: { type: String, required: false }, 
      relation: { type: String, required: false }, 
      contact: { type: String, required: false }, 
    }, 
  ], // Array of embedded reference documents 
  achievement: { type: String }, 
  description: { type: String }, 
  passportPhoto: { type: String }, // Assuming this is a URL or file path 
  certification: { type: String }, // Assuming this is a URL or file path 
  signature: { type: String }, // Assuming this is a URL or file path 
  submitted: { type: Boolean }, 
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
