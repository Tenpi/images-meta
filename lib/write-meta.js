const jpeg = require('./meta-writer/jpeg')
const png = require('./meta-writer/png')

/**
 * Write Metadata into image data
 * 
 * @param {*} data 
 * @param {String} mimeType 
 * @param {Array} metaData
 * @param {String} outputFormat
 *                 options: base64, binaryString, buffer, dataUrl
 */
function writeMeta(data, mimeType, metaData, outputFormat) {
  if (!data || !mimeType || !metaData || !outputFormat) {
    throw new Error('`writeMeta` got invalid arguments')
  }

  switch (mimeType) {
  case 'image/jpeg':
    return jpeg(data, metaData, outputFormat)
  case 'image/png':
    return png(data, metaData, outputFormat)
  default:
    throw new Error('unsupported mimeType: ', mimeType)
  }
}

module.exports = writeMeta
