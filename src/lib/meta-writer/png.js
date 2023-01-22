const extract = require('png-chunks-extract')
const text = require('png-chunk-text')
const encode = require('png-chunks-encode')

const btoa = require('../../utils/btoa')
const {
  convertToBuffer,
  convertToBinaryString,
} = require('../data-converter')

function metaWriter (data, metaData, outputFormat = 'buffer') {
  let buffer = convertToBuffer(data)
  let chunks = extract(buffer)

  // remove all duplicated meta first
  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i]
    if (chunk.name !== 'tEXt') {
      continue
    }
    let ret = text.decode(chunk.data)

    for (let j = 0; j < metaData.length; j++) {
      const meta = metaData[j]
      if (meta.name === ret.keyword && meta.value === ret.text) {
        chunks.splice(i, 1)
        break
      }
    }
  }

  // insert meta
  for (let i = 0; i < metaData.length; i++) {
    let meta = metaData[i]
    
    let value = meta.value
    if (value.length === 0) {
      value = 'null'
    }
    chunks.splice(-1, 0, text.encode(meta.name, value))
  }

  let arrayBuffer = encode(chunks)
  if (outputFormat === 'binaryString') return convertToBinaryString(arrayBuffer)
  if (outputFormat === 'base64') return btoa(convertToBinaryString(arrayBuffer))
  if (outputFormat === 'dataUrl') return `data:image/png;base64,${btoa(convertToBinaryString(arrayBuffer))}`
  if (outputFormat === 'buffer') return arrayBuffer
}

module.exports = metaWriter