function main(str) {
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