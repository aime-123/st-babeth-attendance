const generateReport = async () => ({
  reportType: 'placeholder',
  generatedAt: new Date().toISOString(),
  rows: []
})

module.exports = { generateReport }
