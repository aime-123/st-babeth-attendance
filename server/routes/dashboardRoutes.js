const express = require('express')
const { getAdminDashboard, getTeacherDashboard } = require('../controllers/dashboardController')
const { authMiddleware } = require('../middleware/authMiddleware')
const { authorizeRoles } = require('../middleware/roleMiddleware')

const router = express.Router()

router.get('/admin', authMiddleware, authorizeRoles('admin'), getAdminDashboard)
router.get('/teacher', authMiddleware, authorizeRoles('teacher'), getTeacherDashboard)

module.exports = router
