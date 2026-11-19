export const formatTeacherName = (name) => {
  let isFamilyName = true

  return name.split(/(\s+)/).map((part) => {
    if (/^\s+$/.test(part)) {
      return part
    }

    if (isFamilyName) {
      isFamilyName = false
      return part.toUpperCase()
    }

    return part.toLowerCase().replace(/(^|[-'])(\p{L})/gu, (match, separator, letter) => (
      `${separator}${letter.toUpperCase()}`
    ))
  }).join('')
}
