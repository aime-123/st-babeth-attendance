const express = require('express')
const { getReports } = require('../controllers/reportController')
const { authMiddleware } = require('../middleware/authMiddleware')
const { authorizeRoles } = require('../middleware/roleMiddleware')

const router = express.Router()

router.get('/', authMiddleware, authorizeRoles('admin', 'teacher'), getReports)

module.exports = router
