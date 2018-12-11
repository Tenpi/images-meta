const { load, TagValues, dump, insert } = require('piexifjs')
const extract = require('png-chunks-extract')
const text = require('png-chunk-text')
const encode = require('png-chunks-encode')
const btoa = require('../utils/btoa')
const {
  convertToBuffer,
  convertToBinaryString,
} = require('./data-converter')
const { encodeMetadata } = require('./meta-converter')

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
    let binaryStr = convertToBinaryString(data)
    let ret = load(binaryStr)
    let zeroth = ret['0th'] || {}
    let GPS = ret.GPS || {}
    let Exif = Object.assign({
      [TagValues.ExifIFD.UserComment]: encodeMetadata(metaData)
    }, ret.Exif || {})
    ret = {'0th': zeroth, Exif, GPS}
    let exifStr = dump(ret)
    binaryStr = insert(exifStr, binaryStr)

    if (outputFormat === 'binaryString') return binaryStr
    if (outputFormat === 'base64') return btoa(binaryStr)
    if (outputFormat === 'dataUrl') return `data:${mimeType};base64,${btoa(binaryStr)}`
    if (outputFormat === 'buffer') return convertToBuffer(binaryStr)
  case 'image/png':
    let buffer = convertToBuffer(data)
    let chunks = extract(buffer)
    for (let i = 0; i < metaData.length; i++) {
      let meta = metaData[i]
      chunks.splice(-1, 0, text.encode(meta.name, meta.value))
    }
    let arrayBuffer = encode(chunks)
    if (outputFormat === 'binaryString') return convertToBinaryString(arrayBuffer)
    if (outputFormat === 'base64') return btoa(convertToBinaryString(arrayBuffer))
    if (outputFormat === 'dataUrl') return `data:${mimeType};base64,${btoa(convertToBinaryString(arrayBuffer))}`
    if (outputFormat === 'buffer') return arrayBuffer
  default:
    throw new Error('unsupported mimeType: ', mimeType)
  }
}

module.exports = writeMeta
