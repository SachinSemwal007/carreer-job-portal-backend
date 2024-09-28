// models/applicantmodel.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const applicantSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    age: { type: Number, required: false },
    resume: { type: String, required: false },
    verificationToken: { type: String }, // Store verification token to track verification status
  });
  

// Password hashing before saving the applicant
applicantSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Password matching method
applicantSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const Applicant = mongoose.model('Applicant', applicantSchema);

module.exports = Applicant;
