export const formatStudentName = (field, value) => {
  if (field === 'firstName') return value.toUpperCase()
  if (field === 'lastName' && value) return value[0].toUpperCase() + value.slice(1).toLowerCase()
  if (field === 'guardianName') {
    let wordIndex = 0
    return value.replace(/\S+/g, (word) => {
      wordIndex += 1
      return wordIndex === 1
        ? word.toUpperCase()
        : word[0].toUpperCase() + word.slice(1).toLowerCase()
    })
  }
  return value
}
