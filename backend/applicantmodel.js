// models/applicantmodel.js 
const mongoose = require("mongoose"); 
const bcrypt = require("bcryptjs"); 
const { Schema } = mongoose; 
 
// Define sub-schemas for nested or complex fields 
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
  postId:{type:String,required:true}, 
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
 
const applicantSchema = new mongoose.Schema({ 
  name: { type: String, required: true }, 
  email: { type: String, required: true, unique: true }, 
  password: { type: String, required: true }, 
  age: { type: Number, required: false }, 
  resume: { type: String, required: false }, 
  verificationToken: { type: String }, 
  appliedPositions: [appliedJob], 
  resetPasswordToken: {type: String}, 
  resetPasswordExpires: {type: Date}, 
  // Store verification token to track verification status 
}); 
 
// Password hashing before saving the applicant 
applicantSchema.pre("save", async function (next) { 
  if (!this.isModified("password")) return next(); 
 
  console.log('Hashing the new password for user:', this._id); // Debug log 
 
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
