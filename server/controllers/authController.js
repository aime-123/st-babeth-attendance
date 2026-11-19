const User = require('../models/User')
const { sendSuccess, sendError } = require('../utils/response')

const login = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return sendError(res, 'Email or username and password are required.', 400)
    }

    const loginIdentifier = String(email).trim().toLowerCase()
    const user = await User.findOne({
      $or: [{ email: loginIdentifier }, { username: loginIdentifier }]
    })

    if (!user || user.status !== 'active') {
      return sendError(res, 'Invalid email or password.', 401)
    }

    const isPasswordValid = await user.comparePassword(password)

    if (!isPasswordValid) {
      return sendError(res, 'Invalid email or password.', 401)
    }

    const token = user.generateAuthToken()

    return sendSuccess(res, {
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        username: user.username,
        role: user.role,
        status: user.status,
        profileImage: user.profileImage || '',
        permissions: {
          canMarkAttendance: user.permissions?.canMarkAttendance !== false
        }
      }
    }, 'Login successful.')
  } catch (error) {
    console.error(error)
    return sendError(res, 'Unable to log in at this time.', 500)
  }
}

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password')

    if (!user) {
      return sendError(res, 'User not found.', 404)
    }

    return sendSuccess(res, {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      role: user.role,
      phone: user.phone,
      profileImage: user.profileImage || '',
      status: user.status,
      permissions: {
        canMarkAttendance: user.permissions?.canMarkAttendance !== false
      }
    }, 'User profile fetch successful.')
  } catch (error) {
    console.error(error)
    return sendError(res, 'Unable to fetch user profile.', 500)
  }
}

const updateMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)

    if (!user) {
      return sendError(res, 'User not found.', 404)
    }

    const { fullName, email, phone, profileImage } = req.body || {}
    if (fullName !== undefined) {
      if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 120) {
        return sendError(res, 'Name must be between 2 and 120 characters.', 400)
      }
      user.fullName = fullName.trim()
    }

    if (phone !== undefined) {
      if (typeof phone !== 'string' || phone.trim().length > 30) {
        return sendError(res, 'Phone number must be 30 characters or fewer.', 400)
      }
      user.phone = phone.trim()
    }

    if (email !== undefined) {
      if (typeof email !== 'string') {
        return sendError(res, 'Enter a valid email address.', 400)
      }
      const normalizedEmail = email.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return sendError(res, 'Enter a valid email address.', 400)
      }
      const existingUser = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } })
      if (existingUser) {
        return sendError(res, 'A user with this email already exists.', 409)
      }
      user.email = normalizedEmail
    }

    if (profileImage !== undefined) {
      if (
        typeof profileImage !== 'string' ||
        profileImage.length > 2800000 ||
        (profileImage && !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(profileImage))
      ) {
        return sendError(res, 'Profile image must be a PNG, JPEG, or WebP image smaller than 2 MB.', 400)
      }
      user.profileImage = profileImage
    }

    if (fullName === undefined && email === undefined && phone === undefined && profileImage === undefined) {
      return sendError(res, 'Provide a profile detail or image to update.', 400)
    }

    await user.save()
    return sendSuccess(res, {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      role: user.role,
      phone: user.phone,
      profileImage: user.profileImage || '',
      status: user.status,
      permissions: {
        canMarkAttendance: user.permissions?.canMarkAttendance !== false
      }
    }, 'Profile updated successfully.')
  } catch (error) {
    console.error(error)
    if (error.code === 11000) {
      return sendError(res, 'A user with this email already exists.', 409)
    }
    return sendError(res, 'Unable to update your profile.', 500)
  }
}

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {}
    if (typeof currentPassword !== 'string' || !currentPassword || typeof newPassword !== 'string' || !newPassword) {
      return sendError(res, 'Current password and new password are required.', 400)
    }

    if (newPassword.length < 8) {
      return sendError(res, 'New password must be at least 8 characters.', 400)
    }

    const user = await User.findById(req.user.id)
    if (!user) {
      return sendError(res, 'User not found.', 404)
    }

    if (!(await user.comparePassword(currentPassword))) {
      return sendError(res, 'Current password is incorrect.', 400)
    }

    if (await user.comparePassword(newPassword)) {
      return sendError(res, 'New password must be different from the current password.', 400)
    }

    user.password = newPassword
    await user.save()

    return sendSuccess(res, {
      token: user.generateAuthToken(),
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        username: user.username,
        role: user.role,
        status: user.status,
        profileImage: user.profileImage || '',
        permissions: {
          canMarkAttendance: user.permissions?.canMarkAttendance !== false
        }
      }
    }, 'Password changed successfully.')
  } catch (error) {
    console.error(error)
    return sendError(res, 'Unable to change your password.', 500)
  }
}

module.exports = { login, getMe, updateMe, changePassword }
