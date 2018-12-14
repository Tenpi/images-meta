const atob = require('../utils/atob')

function isDataUrl (data) {
  return data && data.startsWith && data.startsWith('data:image/')
}

function convertToBuffer(data) {
  if (!data) return null

  if (typeof data === 'object') {
    return data
  } else if (typeof data === 'string') {
    let base64 = data
    if (isDataUrl(data)) {
      base64 = dataUrlToBase64(data)
    }
    else if (isBinaryString(data)) {
      return binaryStringToBuffer(data)
    }
    return base64ToBuffer(base64)
  }

  throw new Error('fail to convert data to buffer')
}

function dataUrlToBase64(dataUrl) {
  let idx = dataUrl.indexOf('base64')
  if (idx === -1) {
    throw new Error('input is not a valid base64 string')
  }
  return dataUrl.substr(idx + 7)
}

function base64ToBuffer(base64) {
  return binaryStringToBuffer(atob(base64))
}

function binaryStringToBuffer (binaryStr) {
  if (typeof binaryStr !== 'string') throw new Error('input is not a string')
  // TextEncoder cannot convert binary string
  // if (typeof TextEncoder === 'function') return (new TextEncoder()).encode(binaryStr)
  if (typeof Buffer === 'function') return Buffer.from(binaryStr, 'binary')
  let len = binaryStr.length
  let bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }
  return bytes
}

function convertToBinaryString(data) {
  if (typeof data === 'object') {
    if (data.length >= 0) {
      // TextDecoder cannot convert binary string
      // if (typeof TextDecoder === 'function') return (new TextDecoder()).decode(data)
      return Array.prototype.map.call(data, code => String.fromCharCode(code)).join('')
    }
  } else if (typeof data === 'string') {
    if (isDataUrl(data)) {
      return atob(dataUrlToBase64(data))
    }
    return data
  }

  throw new Error('fail to convert data to binary string')
}

function isBinaryString (data) {
  return typeof data === 'string' && /[^\x20-\x7E\t\r\n]/.test(data)
}

module.exports = {
  convertToBuffer,
  dataUrlToBase64,
  base64ToBuffer,
  convertToBinaryString,
}
