export const normalizeRwandaPhone = (value) => {
  const phone = String(value ?? '').trim()
  if (/^\+250\d{9}$/.test(phone)) return phone
  if (/^0\d{9}$/.test(phone)) return `+250${phone.slice(1)}`
  return ''
}

export const getRwandaNationalNumber = (value) => {
  const normalizedPhone = normalizeRwandaPhone(value)
  return normalizedPhone ? normalizedPhone.slice(4) : String(value ?? '').trim()
}
