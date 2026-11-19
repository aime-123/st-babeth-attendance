const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { env } = require('../config/env')

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  username: {
    type: String,
    trim: true,
    lowercase: true,
    minlength: 3,
    maxlength: 30,
    match: /^[a-z0-9._-]+$/,
    unique: true,
    sparse: true
  },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'teacher'], default: 'teacher' },
  permissions: {
    canMarkAttendance: { type: Boolean, default: true }
  },
  customAttendanceReasons: {
    type: [String],
    default: [],
    validate: {
      validator: (reasons) => reasons.length <= 100 && reasons.every((reason) => reason.length <= 100),
      message: 'Custom attendance reasons must not exceed 100 items or 100 characters each.'
    }
  },
  timetableDocument: {
    fileName: { type: String, default: '' },
    contentType: { type: String, default: 'application/octet-stream' },
    contentBase64: { type: String, default: '' },
    uploadedAt: { type: Date, default: null }
  },
  phone: { type: String, default: '' },
  profileImage: { type: String, default: '' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, {
  timestamps: true
})

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) {
    return
  }

  const salt = await bcrypt.genSalt(10)
  this.password = await bcrypt.hash(this.password, salt)
})

userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

userSchema.methods.generateAuthToken = function generateAuthToken() {
  return jwt.sign(
    {
      id: this._id,
      email: this.email,
      username: this.username,
      role: this.role,
      fullName: this.fullName
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  )
}

module.exports = mongoose.model('User', userSchema)
