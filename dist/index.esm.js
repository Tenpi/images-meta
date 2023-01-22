import piexifjs from 'piexifjs';
import pngChunksExtract from 'png-chunks-extract';
import pngChunkText from 'png-chunk-text';
import pngChunksEncode from 'png-chunks-encode';

function main(str) {
  // eslint-disable-next-line no-undef
  if (typeof atob === 'function') return atob(str)
  return Buffer.from(str, 'base64').toString('binary')
}

var atob_1 = main;

function isDataUrl (data) {
  return data && data.startsWith && data.startsWith('data:image/')
}

function convertToBuffer(data) {
  if (!data) return null

  if (typeof data === 'object') {
    return data
  } else if (typeof data === 'string') {
    let base64 = data;
    if (isDataUrl(data)) {
      base64 = dataUrlToBase64(data);
    }
    else if (isBinaryString(data)) {
      return binaryStringToBuffer(data)
    }
    return base64ToBuffer(base64)
  }

  throw new Error('fail to convert data to buffer')
}

function dataUrlToBase64(dataUrl) {
  let idx = dataUrl.indexOf('base64');
  if (idx === -1) {
    throw new Error('input is not a valid base64 string')
  }
  return dataUrl.substr(idx + 7)
}

function base64ToBuffer(base64) {
  return binaryStringToBuffer(atob_1(base64))
}

function binaryStringToBuffer (binaryStr) {
  if (typeof binaryStr !== 'string') throw new Error('input is not a string')
  // TextEncoder cannot convert binary string
  // if (typeof TextEncoder === 'function') return (new TextEncoder()).encode(binaryStr)
  if (typeof Buffer === 'function') return Buffer.from(binaryStr, 'binary')
  let len = binaryStr.length;
  let bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
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
      return atob_1(dataUrlToBase64(data))
    }
    return data
  }

  throw new Error('fail to convert data to binary string')
}

function isBinaryString (data) {
  return typeof data === 'string' && /[^\x20-\x7E\t\r\n]/.test(data)
}

var dataConverter = {
  convertToBuffer,
  dataUrlToBase64,
  base64ToBuffer,
  convertToBinaryString,
};

const WORD_SEPARATOR = '~_';
const META_SEPARATOR = '_|';
const SIG = 'Mt_';

function encodeMetadata (metadata) {
  return metadata.map(meta => {
    return `${meta.value}`
  }).join("")
}

function decodeMetadata (string) {
  if (!string.startsWith(SIG)) return string
  return string.slice(SIG.length).split(META_SEPARATOR).map(metaStr => {
    let [name, value] = metaStr.split(WORD_SEPARATOR);
    return {name: unescape(name), value: unescape(value)}
  })
}

var metaConverter = {
  encodeMetadata,
  decodeMetadata,
};

const { load, TAGS } = piexifjs;

const {
  convertToBinaryString: convertToBinaryString$1,
} = dataConverter;
const { decodeMetadata: decodeMetadata$1 } = metaConverter;

function metaReader (data) {
  let binaryStr = convertToBinaryString$1(data);
  let ret = load(binaryStr);
  let results = [];
  for (let key in ret) {
    let obj = ret[key];
    let dict;
    if (key === '0th') {
      dict = TAGS.Image;
    } else if (key === 'Exif') {
      dict = TAGS.Exif;
    } else {
      dict = TAGS.GPS;
    }
    for (let id in obj) {
      let def = dict[id];
      let name = (def && def.name) || 'unknown';
      if (name === 'UserComment') {
        let decoded = decodeMetadata$1(obj[id]);
        if (Array.isArray(decoded)) {
          decoded.forEach(meta => results.push(meta));
          continue
        }
      }
      results.push({
        name,
        value: obj[id],
      });
    }
  }
  return results
}

var jpeg = metaReader;

const {
  convertToBuffer: convertToBuffer$1,
} = dataConverter;

function metaReader$1(data) {
  let buffer = convertToBuffer$1(data);
  let chunks = pngChunksExtract(buffer);
  return chunks.filter(function (chunk) {
    return chunk.name === 'tEXt'
  }).map(function (chunk) {
    let ret = pngChunkText.decode(chunk.data);
    return {
      name: unescape(ret.keyword),
      value: unescape(ret.text)
    }
  })
}

var png = metaReader$1;

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
    return jpeg(data)
  case 'image/png':
    return png(data)
  default:
    throw new Error('unsupported mimeType: ', mimeType)
  }
}


var readMeta_1 = readMeta;

function main$1(str) {
  // eslint-disable-next-line no-undef
  if (typeof btoa === 'function') return btoa(str)

  var buffer;
  if (str instanceof Buffer) {
    buffer = str;
  } else {
    buffer = Buffer.from(str.toString(), 'binary');
  }

  return buffer.toString('base64')
}

var btoa_1 = main$1;

const { load: load$1, ExifIFD, dump, insert } = piexifjs;


const {
  convertToBuffer: convertToBuffer$2,
  convertToBinaryString: convertToBinaryString$2,
} = dataConverter;
const { encodeMetadata: encodeMetadata$1 } = metaConverter;

function metaWriter (data, metaData, outputFormat = 'buffer') {
  let binaryStr = convertToBinaryString$2(data);
  let ret = load$1(binaryStr);
  let zeroth = ret['0th'] || {};
  let GPS = ret.GPS || {};
  let Exif = Object.assign({}, ret.Exif, {
    [ExifIFD.UserComment]: encodeMetadata$1(metaData)
  });
  ret = {'0th': zeroth, Exif, GPS};
  let exifStr = dump(ret);
  binaryStr = insert(exifStr, binaryStr);

  if (outputFormat === 'binaryString') return binaryStr
  if (outputFormat === 'base64') return btoa_1(binaryStr)
  if (outputFormat === 'dataUrl') return `data:image/jpeg;base64,${btoa_1(binaryStr)}`
  if (outputFormat === 'buffer') return convertToBuffer$2(binaryStr)
}

var jpeg$1 = metaWriter;

const {
  convertToBuffer: convertToBuffer$3,
  convertToBinaryString: convertToBinaryString$3,
} = dataConverter;

function metaWriter$1 (data, metaData, outputFormat = 'buffer') {
  let buffer = convertToBuffer$3(data);
  let chunks = pngChunksExtract(buffer);

  // remove all duplicated meta first
  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i];
    if (chunk.name !== 'tEXt') {
      continue
    }
    let ret = pngChunkText.decode(chunk.data);

    for (let j = 0; j < metaData.length; j++) {
      const meta = metaData[j];
      if (meta.name === ret.keyword && meta.value === ret.text) {
        chunks.splice(i, 1);
        break
      }
    }
  }

  // insert meta
  for (let i = 0; i < metaData.length; i++) {
    let meta = metaData[i];
    
    let value = meta.value;
    if (value.length === 0) {
      value = 'null';
    }
    chunks.splice(-1, 0, pngChunkText.encode(meta.name, value));
  }

  let arrayBuffer = pngChunksEncode(chunks);
  if (outputFormat === 'binaryString') return convertToBinaryString$3(arrayBuffer)
  if (outputFormat === 'base64') return btoa_1(convertToBinaryString$3(arrayBuffer))
  if (outputFormat === 'dataUrl') return `data:image/png;base64,${btoa_1(convertToBinaryString$3(arrayBuffer))}`
  if (outputFormat === 'buffer') return arrayBuffer
}

var png$1 = metaWriter$1;

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
    return jpeg$1(data, metaData, outputFormat)
  case 'image/png':
    return png$1(data, metaData, outputFormat)
  default:
    throw new Error('unsupported mimeType: ', mimeType)
  }
}

var writeMeta_1 = writeMeta;

var src = {
  readMeta: readMeta_1,
  writeMeta: writeMeta_1,
};
var src_1 = src.readMeta;
var src_2 = src.writeMeta;

export default src;
export { src_1 as readMeta, src_2 as writeMeta };
//# sourceMappingURL=index.esm.js.map
