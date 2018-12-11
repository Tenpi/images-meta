function main(str) {
  if (typeof atob === 'function') return atob(str)
  return Buffer.from(str, 'base64').toString('binary')
}

module.exports = main