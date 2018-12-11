function main(str) {
  // eslint-disable-next-line no-undef
  if (typeof btoa === 'function') return btoa(str)

  var buffer
  if (str instanceof Buffer) {
    buffer = str
  } else {
    buffer = Buffer.from(str.toString(), 'binary')
  }

  return buffer.toString('base64')
}

module.exports = main