const mongoose = require('mongoose')
const AdminNotification = require('../models/AdminNotification')
const TeacherNotification = require('../models/TeacherNotification')
const User = require('../models/User')
const { sendSuccess, sendError } = require('../utils/response')
const { publishTeacherNotification } = require('../utils/teacherNotifications')

const getNotifications = async (_req, res) => {
  try {
    const [items, unreadCount] = await Promise.all([
      AdminNotification.find().sort({ createdAt: -1 }).limit(50).lean(),
      AdminNotification.countDocuments({ readAt: null })
    ])

    return sendSuccess(res, { items, unreadCount }, 'Admin notifications fetched successfully.')
  } catch (error) {
    console.error(error)
    return sendError(res, 'Unable to fetch admin notifications.', 500)
  }
}

const markNotificationRead = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return sendError(res, 'Notification ID is invalid.', 400)
  }

  try {
    const notification = await AdminNotification.findByIdAndUpdate(
      req.params.id,
      { $set: { readAt: new Date() } },
      { new: true }
    ).lean()

    if (!notification) {
      return sendError(res, 'Notification was not found.', 404)
    }

    return sendSuccess(res, notification, 'Notification marked as read.')
  } catch (error) {
    console.error(error)
    return sendError(res, 'Unable to update the notification.', 500)
  }
}

const markAllNotificationsRead = async (_req, res) => {
  try {
    const result = await AdminNotification.updateMany(
      { readAt: null },
      { $set: { readAt: new Date() } }
    )

    return sendSuccess(res, { updatedCount: result.modifiedCount }, 'All notifications marked as read.')
  } catch (error) {
    console.error(error)
    return sendError(res, 'Unable to update admin notifications.', 500)
  }
}

const sendTeacherMessage = async (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : ''

  if (title.length < 2 || title.length > 120) {
    return sendError(res, 'Message title must be between 2 and 120 characters.', 400)
  }

  if (message.length < 1 || message.length > 2000) {
    return sendError(res, 'Message must be between 1 and 2000 characters.', 400)
  }

  try {
    const teachers = await User.find({ role: 'teacher', status: 'active' }).select('_id').lean()
    if (teachers.length === 0) {
      return sendError(res, 'There are no active teachers to receive this message.', 409)
    }

    const notifications = await TeacherNotification.insertMany(teachers.map((teacher) => ({
      teacherId: teacher._id,
      senderAdminId: req.user.id,
      title,
      message
    })))

    for (const notification of notifications) {
      publishTeacherNotification(notification.teacherId, notification.toObject())
    }

    return sendSuccess(res, { recipientCount: notifications.length }, 'Message sent to all active teachers.', 201)
  } catch (error) {
    console.error(error)
    return sendError(res, 'Unable to send the teacher message.', 500)
  }
}

const getTeacherMessages = async (req, res) => {
  try {
    const [items, unreadCount] = await Promise.all([
      TeacherNotification.find({ teacherId: req.user.id }).sort({ createdAt: -1 }).limit(50).lean(),
      TeacherNotification.countDocuments({ teacherId: req.user.id, readAt: null })
    ])

    return sendSuccess(res, { items, unreadCount }, 'Teacher messages fetched successfully.')
  } catch (error) {
    console.error(error)
    return sendError(res, 'Unable to fetch teacher messages.', 500)
  }
}

const markTeacherMessageRead = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return sendError(res, 'Message ID is invalid.', 400)
  }

  try {
    const notification = await TeacherNotification.findOneAndUpdate(
      { _id: req.params.id, teacherId: req.user.id },
      { $set: { readAt: new Date() } },
      { new: true }
    ).lean()

    if (!notification) {
      return sendError(res, 'Message was not found.', 404)
    }

    return sendSuccess(res, notification, 'Message marked as read.')
  } catch (error) {
    console.error(error)
    return sendError(res, 'Unable to update the teacher message.', 500)
  }
}

const markAllTeacherMessagesRead = async (req, res) => {
  try {
    const result = await TeacherNotification.updateMany(
      { teacherId: req.user.id, readAt: null },
      { $set: { readAt: new Date() } }
    )

    return sendSuccess(res, { updatedCount: result.modifiedCount }, 'All messages marked as read.')
  } catch (error) {
    console.error(error)
    return sendError(res, 'Unable to update teacher messages.', 500)
  }
}

module.exports = {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  sendTeacherMessage,
  getTeacherMessages,
  markTeacherMessageRead,
  markAllTeacherMessagesRead
}
