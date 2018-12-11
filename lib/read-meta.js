const { load, Tags } = require('piexifjs')
const extract = require('png-chunks-extract')
const text = require('png-chunk-text')
const {
  convertToBuffer,
  convertToBinaryString,
} = require('./data-converter')
const { decodeMetadata } = require('./meta-converter')

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
    let binaryStr = convertToBinaryString(data)
    let ret = load(binaryStr)
    let results = []
    for (let key in ret) {
      let obj = ret[key]
      let dict
      if (key === '0th') {
        dict = Tags.Image
      } else if (key === 'Exif') {
        dict = Tags.Exif
      } else {
        dict = Tags.GPS
      }
      for (let id in obj) {
        let def = dict[id]
        let name = (def && def.name) || 'unknown'
        if (name === 'UserComment') {
          let decoded = decodeMetadata(obj[id])
          if (Array.isArray(decoded)) {
            decoded.forEach(meta => results.push(meta))
            continue
          }
        }
        results.push({
          name,
          value: obj[id],
        })
      }
    }
    return results
  case 'image/png':
    let buffer = convertToBuffer(data)
    console.log('buffer', buffer)
    let chunks = extract(buffer)
    return chunks.filter(function (chunk) {
      return chunk.name === 'tEXt'
    }).map(function (chunk) {
      let ret = text.decode(chunk.data)
      return { name: ret.keyword, value: ret.text }
    })
  default:
    throw new Error('unsupported mimeType: ', mimeType)
  }
}

module.exports = readMeta
