const express = require('express')
const { authMiddleware } = require('../middleware/authMiddleware')
const { authorizeRoles } = require('../middleware/roleMiddleware')
const { subscribeAdminNotifications } = require('../utils/adminNotifications')
const { subscribeTeacherNotifications } = require('../utils/teacherNotifications')
const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  sendTeacherMessage,
  getTeacherMessages,
  markTeacherMessageRead,
  markAllTeacherMessagesRead
} = require('../controllers/notificationController')

const router = express.Router()

router.get('/', authMiddleware, authorizeRoles('admin'), getNotifications)
router.patch('/read-all', authMiddleware, authorizeRoles('admin'), markAllNotificationsRead)
router.patch('/:id/read', authMiddleware, authorizeRoles('admin'), markNotificationRead)
router.post('/messages', authMiddleware, authorizeRoles('admin'), sendTeacherMessage)

router.get('/teacher/messages', authMiddleware, authorizeRoles('teacher'), getTeacherMessages)
router.patch('/teacher/messages/read-all', authMiddleware, authorizeRoles('teacher'), markAllTeacherMessagesRead)
router.patch('/teacher/messages/:id/read', authMiddleware, authorizeRoles('teacher'), markTeacherMessageRead)

router.get('/stream', authMiddleware, authorizeRoles('admin'), (req, res) => {
  res.status(200).set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  })

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders()
  }

  res.write(': connected\n\n')
  const unsubscribe = subscribeAdminNotifications(res)
  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 25000)

  res.on('close', () => {
    clearInterval(heartbeat)
    unsubscribe()
  })
})

router.get('/teacher/messages/stream', authMiddleware, authorizeRoles('teacher'), (req, res) => {
  res.status(200).set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  })

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders()
  }

  res.write(': connected\n\n')
  const unsubscribe = subscribeTeacherNotifications(req.user.id, res)
  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 25000)

  res.on('close', () => {
    clearInterval(heartbeat)
    unsubscribe()
  })
})

module.exports = router
