const readline = require('node:readline')
const dotenv = require('dotenv')
const mongoose = require('mongoose')

dotenv.config({ quiet: true })

const User = require('../models/User')
const { env } = require('../config/env')

const ask = (interface, prompt) => new Promise((resolve) => {
  interface.question(prompt, resolve)
})

const askSecret = (prompt) => new Promise((resolve, reject) => {
  const { stdin, stdout } = process
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    reject(new Error('Run this command in an interactive terminal to enter the password securely.'))
    return
  }

  let value = ''
  const cleanup = () => {
    stdin.removeListener('data', onData)
    stdin.setRawMode(false)
    stdin.pause()
    stdout.write('\n')
  }
  const onData = (key) => {
    if (key === '\u0003') {
      cleanup()
      reject(new Error('Administrator setup cancelled.'))
      return
    }

    if (key === '\r' || key === '\n') {
      cleanup()
      resolve(value)
      return
    }

    if (key === '\u007f' || key === '\b') {
      value = value.slice(0, -1)
      stdout.write('\b \b')
      return
    }

    value += key
    stdout.write('*')
  }

  stdout.write(prompt)
  stdin.setRawMode(true)
  stdin.setEncoding('utf8')
  stdin.resume()
  stdin.on('data', onData)
})

const createAdmin = async () => {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })

  if (await User.exists({ role: 'admin' })) {
    throw new Error('An administrator already exists. Sign in with an existing admin account instead.')
  }

  const prompt = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  let fullName
  let email
  try {
    fullName = (await ask(prompt, 'Administrator full name: ')).trim()
    email = (await ask(prompt, 'Administrator email: ')).trim().toLowerCase()
  } finally {
    prompt.close()
  }

  if (fullName.length < 2 || fullName.length > 120) {
    throw new Error('Name must be between 2 and 120 characters.')
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid email address.')
  }

  const password = await askSecret('New password (minimum 12 characters): ')
  const confirmation = await askSecret('Confirm password: ')
  if (password.length < 12) {
    throw new Error('Password must be at least 12 characters.')
  }
  if (password !== confirmation) {
    throw new Error('Passwords do not match.')
  }

  await User.create({ fullName, email, password, role: 'admin' })
  console.log('Administrator account created.')
}

createAdmin()
  .catch((error) => {
    console.error(`Unable to create administrator: ${error.message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
