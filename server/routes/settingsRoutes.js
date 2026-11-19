const express = require('express')
const { getSchoolSettings, updateSchoolSettings } = require('../controllers/settingsController')
const { authMiddleware } = require('../middleware/authMiddleware')
const { authorizeRoles } = require('../middleware/roleMiddleware')

const router = express.Router()

router.get('/school', getSchoolSettings)
router.put('/school', authMiddleware, authorizeRoles('admin'), updateSchoolSettings)

module.exports = router
