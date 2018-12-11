const { load, Tags } = require('piexifjs')

const {
  convertToBinaryString,
} = require('../data-converter')
const { decodeMetadata } = require('../meta-converter')

function metaReader (data) {
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
}

module.exports = metaReader