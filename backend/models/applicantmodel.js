// models/applicantmodel.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { Schema } = mongoose;


// Main Post schema
const appliedJob = new Schema({
  applicationId: { type: String, required: false },
  applicantId: { type: String, required: false },
  sport: { type: String, required: false },
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

const applicantSchema = new mongoose.Schema({
  jobId: { type: Schema.Types.ObjectId, ref: "Job" }, // Reference to Job model
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, 
  verificationToken: { type: String },
  appliedPositions: [appliedJob],
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  // Store verification token to track verification status
});

// Password hashing before saving the applicant
applicantSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  console.log("Hashing the new password for user:", this._id); // Debug log

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Password matching method
applicantSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const Applicant = mongoose.model("Applicant", applicantSchema);

module.exports = Applicant;
