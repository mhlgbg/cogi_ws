export function formatNumber(value, options = {}) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return '0'
  }

  return new Intl.NumberFormat('vi-VN', options).format(number)
}