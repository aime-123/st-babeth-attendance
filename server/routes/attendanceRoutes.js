const express = require('express')
const {
  getAttendance,
  getAttendanceSummary,
  getCustomAttendanceReasons,
  saveCustomAttendanceReasons,
  getAttendanceHistory,
  markAttendance
} = require('../controllers/attendanceController')
const { authMiddleware } = require('../middleware/authMiddleware')
const { authorizeRoles } = require('../middleware/roleMiddleware')

const router = express.Router()

router.get('/reasons', authMiddleware, authorizeRoles('teacher'), getCustomAttendanceReasons)
router.post('/reasons', authMiddleware, authorizeRoles('teacher'), saveCustomAttendanceReasons)
router.get('/', authMiddleware, authorizeRoles('admin', 'teacher'), getAttendance)
router.get('/summary', authMiddleware, authorizeRoles('admin', 'teacher'), getAttendanceSummary)
router.get('/history', authMiddleware, authorizeRoles('admin', 'teacher'), getAttendanceHistory)
router.post('/mark', authMiddleware, authorizeRoles('teacher'), markAttendance)

module.exports = router
