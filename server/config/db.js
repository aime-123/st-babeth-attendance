const mongoose = require('mongoose')
const { env } = require('./env')

mongoose.set('strictQuery', true)

const connectDB = async () => {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    })

  } catch (error) {
    console.warn('MongoDB connection failed. Please ensure MongoDB is running on the configured URI.')
    console.warn(error.message)
    throw error
  }
}

module.exports = { connectDB }
