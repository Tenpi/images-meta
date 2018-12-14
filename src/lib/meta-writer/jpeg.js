const { load, TagValues, dump, insert } = require('piexifjs')

const btoa = require('../../utils/btoa')
const {
  convertToBuffer,
  convertToBinaryString,
} = require('../data-converter')
const { encodeMetadata } = require('../meta-converter')

function metaWriter (data, metaData, outputFormat = 'buffer') {
  let binaryStr = convertToBinaryString(data)
  let ret = load(binaryStr)
  let zeroth = ret['0th'] || {}
  let GPS = ret.GPS || {}
  let Exif = Object.assign({}, ret.Exif, {
    [TagValues.ExifIFD.UserComment]: encodeMetadata(metaData)
  })
  ret = {'0th': zeroth, Exif, GPS}
  let exifStr = dump(ret)
  binaryStr = insert(exifStr, binaryStr)

  if (outputFormat === 'binaryString') return binaryStr
  if (outputFormat === 'base64') return btoa(binaryStr)
  if (outputFormat === 'dataUrl') return `data:image/jpeg;base64,${btoa(binaryStr)}`
  if (outputFormat === 'buffer') return convertToBuffer(binaryStr)
}

module.exports = metaWriter