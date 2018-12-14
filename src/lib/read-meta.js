const jpeg = require('./meta-reader/jpeg')
const png = require('./meta-reader/png')

/**
 * Read Metadata from image data
 * 
 * @param {*} data 
 * @param {String} mimeType 
 */
function readMeta(data, mimeType) {
  if (!data || !mimeType) {
    throw new Error('`readMeta` got invalid arguments')
  }

  switch (mimeType) {
  case 'image/jpeg':
    return jpeg(data)
  case 'image/png':
    return png(data)
  default:
    throw new Error('unsupported mimeType: ', mimeType)
  }
}


module.exports = readMeta
