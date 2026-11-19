const parseClientUrls = () => {
  const configured = process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173'

  return configured
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

const env = {
  PORT: process.env.PORT || 5000,
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  CLIENT_URLS: parseClientUrls(),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/st-babeth-attendance',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-key-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d'
}

module.exports = { env }
