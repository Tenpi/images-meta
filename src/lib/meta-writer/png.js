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
  for (let i = 0; i < metaData.length; i++) {
    let meta = metaData[i]
    chunks.splice(-1, 0, text.encode(meta.name, meta.value))
  }
  let arrayBuffer = encode(chunks)
  if (outputFormat === 'binaryString') return convertToBinaryString(arrayBuffer)
  if (outputFormat === 'base64') return btoa(convertToBinaryString(arrayBuffer))
  if (outputFormat === 'dataUrl') return `data:image/png;base64,${btoa(convertToBinaryString(arrayBuffer))}`
  if (outputFormat === 'buffer') return arrayBuffer
}

module.exports = metaWriter