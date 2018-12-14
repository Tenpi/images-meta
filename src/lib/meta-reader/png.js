const extract = require('png-chunks-extract')
const text = require('png-chunk-text')

const {
  convertToBuffer,
} = require('../data-converter')

function metaReader(data) {
  let buffer = convertToBuffer(data)
  let chunks = extract(buffer)
  return chunks.filter(function (chunk) {
    return chunk.name === 'tEXt'
  }).map(function (chunk) {
    let ret = text.decode(chunk.data)
    return {
      name: ret.keyword,
      value: ret.text
    }
  })
}

module.exports = metaReader