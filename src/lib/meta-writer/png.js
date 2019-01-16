const extract = require('png-chunks-extract')
const text = require('png-chunk-text')
const encode = require('png-chunks-encode')

const btoa = require('../../utils/btoa')
const {
  convertToBuffer,
  convertToBinaryString,
} = require('../data-converter')

const NON_ASCII_REGEX = /[^\u0021-\u007E]/g

function metaWriter (data, metaData, outputFormat = 'buffer') {
  let buffer = convertToBuffer(data)
  let chunks = extract(buffer)

  // 预处理 metaData
  let filteredMeta = []
  for (let i = metaData.length - 1; i >= 0; i--) {
    const meta = metaData[i]
    let name = String(meta.name).replace(NON_ASCII_REGEX, '')
    if (name.length === 0) {
      continue
    }

    let value = String(meta.value).replace(NON_ASCII_REGEX, '')
    if (value.length === 0) {
      value = 'null'
    }

    filteredMeta.push({ name, value })
  }

  // remove all duplicated meta first
  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i]
    if (chunk.name !== 'tEXt') {
      continue
    }
    let ret = text.decode(chunk.data)

    for (let j = 0; j < filteredMeta.length; j++) {
      const meta = filteredMeta[j]
      if (meta.name === ret.keyword && meta.value === ret.text) {
        chunks.splice(i, 1)
        break
      }
    }
  }

  // insert meta
  for (let i = 0; i < filteredMeta.length; i++) {
    let meta = filteredMeta[i]
    chunks.splice(-1, 0, text.encode(meta.name, meta.value))
  }

  let arrayBuffer = encode(chunks)
  if (outputFormat === 'binaryString') return convertToBinaryString(arrayBuffer)
  if (outputFormat === 'base64') return btoa(convertToBinaryString(arrayBuffer))
  if (outputFormat === 'dataUrl') return `data:image/png;base64,${btoa(convertToBinaryString(arrayBuffer))}`
  if (outputFormat === 'buffer') return arrayBuffer
}

module.exports = metaWriter