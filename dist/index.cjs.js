'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var piexifjs = _interopDefault(require('piexifjs'));
var pngChunksExtract = _interopDefault(require('png-chunks-extract'));
var pngChunkText = _interopDefault(require('png-chunk-text'));
var pngChunksEncode = _interopDefault(require('png-chunks-encode'));

function _typeof(obj) {
  if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
    _typeof = function (obj) {
      return typeof obj;
    };
  } else {
    _typeof = function (obj) {
      return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
    };
  }

  return _typeof(obj);
}

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

function _slicedToArray(arr, i) {
  return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest();
}

function _arrayWithHoles(arr) {
  if (Array.isArray(arr)) return arr;
}

function _iterableToArrayLimit(arr, i) {
  var _arr = [];
  var _n = true;
  var _d = false;
  var _e = undefined;

  try {
    for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
      _arr.push(_s.value);

      if (i && _arr.length === i) break;
    }
  } catch (err) {
    _d = true;
    _e = err;
  } finally {
    try {
      if (!_n && _i["return"] != null) _i["return"]();
    } finally {
      if (_d) throw _e;
    }
  }

  return _arr;
}

function _nonIterableRest() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance");
}

function main(str) {
  // eslint-disable-next-line no-undef
  if (typeof atob === 'function') return atob(str);
  return Buffer.from(str, 'base64').toString('binary');
}

var atob_1 = main;

function isDataUrl(data) {
  return data && data.startsWith && data.startsWith('data:image/');
}

function convertToBuffer(data) {
  if (!data) return null;

  if (_typeof(data) === 'object') {
    return data;
  } else if (typeof data === 'string') {
    var base64 = data;

    if (isDataUrl(data)) {
      base64 = dataUrlToBase64(data);
    } else if (isBinaryString(data)) {
      return binaryStringToBuffer(data);
    }

    return base64ToBuffer(base64);
  }

  throw new Error('fail to convert data to buffer');
}

function dataUrlToBase64(dataUrl) {
  var idx = dataUrl.indexOf('base64');

  if (idx === -1) {
    throw new Error('input is not a valid base64 string');
  }

  return dataUrl.substr(idx + 7);
}

function base64ToBuffer(base64) {
  return binaryStringToBuffer(atob_1(base64));
}

function binaryStringToBuffer(binaryStr) {
  if (typeof binaryStr !== 'string') throw new Error('input is not a string'); // TextEncoder cannot convert binary string
  // if (typeof TextEncoder === 'function') return (new TextEncoder()).encode(binaryStr)

  if (typeof Buffer === 'function') return Buffer.from(binaryStr, 'binary');
  var len = binaryStr.length;
  var bytes = new Uint8Array(len);

  for (var i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  return bytes;
}

function convertToBinaryString(data) {
  if (_typeof(data) === 'object') {
    if (data.length >= 0) {
      // TextDecoder cannot convert binary string
      // if (typeof TextDecoder === 'function') return (new TextDecoder()).decode(data)
      return Array.prototype.map.call(data, function (code) {
        return String.fromCharCode(code);
      }).join('');
    }
  } else if (typeof data === 'string') {
    if (isDataUrl(data)) {
      return atob_1(dataUrlToBase64(data));
    }

    return data;
  }

  throw new Error('fail to convert data to binary string');
}

function isBinaryString(data) {
  return typeof data === 'string' && /[^\x20-\x7E\t\r\n]/.test(data);
}

var dataConverter = {
  convertToBuffer: convertToBuffer,
  dataUrlToBase64: dataUrlToBase64,
  base64ToBuffer: base64ToBuffer,
  convertToBinaryString: convertToBinaryString
};

var WORD_SEPARATOR = '~_';
var META_SEPARATOR = '_|';
var SIG = 'Mt_';

function encodeMetadata(metadata) {
  return metadata.map(function (meta) {
    return "".concat(meta.value);
  }).join("");
}

function decodeMetadata(string) {
  if (!string.startsWith(SIG)) return string;
  return string.slice(SIG.length).split(META_SEPARATOR).map(function (metaStr) {
    var _metaStr$split = metaStr.split(WORD_SEPARATOR),
        _metaStr$split2 = _slicedToArray(_metaStr$split, 2),
        name = _metaStr$split2[0],
        value = _metaStr$split2[1];

    return {
      name: unescape(name),
      value: unescape(value)
    };
  });
}

var metaConverter = {
  encodeMetadata: encodeMetadata,
  decodeMetadata: decodeMetadata
};

var load = piexifjs.load,
    TAGS = piexifjs.TAGS;
var convertToBinaryString$1 = dataConverter.convertToBinaryString;
var decodeMetadata$1 = metaConverter.decodeMetadata;

function metaReader(data) {
  var binaryStr = convertToBinaryString$1(data);
  var ret = load(binaryStr);
  var results = [];

  for (var key in ret) {
    var obj = ret[key];
    var dict = void 0;

    if (key === '0th') {
      dict = TAGS.Image;
    } else if (key === 'Exif') {
      dict = TAGS.Exif;
    } else {
      dict = TAGS.GPS;
    }

    for (var id in obj) {
      var def = dict[id];
      var name = def && def.name || 'unknown';

      if (name === 'UserComment') {
        var decoded = decodeMetadata$1(obj[id]);

        if (Array.isArray(decoded)) {
          decoded.forEach(function (meta) {
            return results.push(meta);
          });
          continue;
        }
      }

      results.push({
        name: name,
        value: obj[id]
      });
    }
  }

  return results;
}

var jpeg = metaReader;

var convertToBuffer$1 = dataConverter.convertToBuffer;

function metaReader$1(data) {
  var buffer = convertToBuffer$1(data);
  var chunks = pngChunksExtract(buffer);
  return chunks.filter(function (chunk) {
    return chunk.name === 'tEXt';
  }).map(function (chunk) {
    var ret = pngChunkText.decode(chunk.data);
    return {
      name: unescape(ret.keyword),
      value: unescape(ret.text)
    };
  });
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
    throw new Error('`readMeta` got invalid arguments');
  }

  switch (mimeType) {
    case 'image/jpeg':
      return jpeg(data);

    case 'image/png':
      return png(data);

    default:
      throw new Error('unsupported mimeType: ', mimeType);
  }
}

var readMeta_1 = readMeta;

function main$1(str) {
  // eslint-disable-next-line no-undef
  if (typeof btoa === 'function') return btoa(str);
  var buffer;

  if (str instanceof Buffer) {
    buffer = str;
  } else {
    buffer = Buffer.from(str.toString(), 'binary');
  }

  return buffer.toString('base64');
}

var btoa_1 = main$1;

var load$1 = piexifjs.load,
    ExifIFD = piexifjs.ExifIFD,
    dump = piexifjs.dump,
    insert = piexifjs.insert;
var convertToBuffer$2 = dataConverter.convertToBuffer,
    convertToBinaryString$2 = dataConverter.convertToBinaryString;
var encodeMetadata$1 = metaConverter.encodeMetadata;

function metaWriter(data, metaData) {
  var outputFormat = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'buffer';
  var binaryStr = convertToBinaryString$2(data);
  var ret = load$1(binaryStr);
  var zeroth = ret['0th'] || {};
  var GPS = ret.GPS || {};
  var Exif = Object.assign({}, ret.Exif, _defineProperty({}, ExifIFD.UserComment, encodeMetadata$1(metaData)));
  ret = {
    '0th': zeroth,
    Exif: Exif,
    GPS: GPS
  };
  var exifStr = dump(ret);
  binaryStr = insert(exifStr, binaryStr);
  if (outputFormat === 'binaryString') return binaryStr;
  if (outputFormat === 'base64') return btoa_1(binaryStr);
  if (outputFormat === 'dataUrl') return "data:image/jpeg;base64,".concat(btoa_1(binaryStr));
  if (outputFormat === 'buffer') return convertToBuffer$2(binaryStr);
}

var jpeg$1 = metaWriter;

var convertToBuffer$3 = dataConverter.convertToBuffer,
    convertToBinaryString$3 = dataConverter.convertToBinaryString;

function metaWriter$1(data, metaData) {
  var outputFormat = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'buffer';
  var buffer = convertToBuffer$3(data);
  var chunks = pngChunksExtract(buffer); // remove all duplicated meta first

  for (var i = chunks.length - 1; i >= 0; i--) {
    var chunk = chunks[i];

    if (chunk.name !== 'tEXt') {
      continue;
    }

    var ret = pngChunkText.decode(chunk.data);

    for (var j = 0; j < metaData.length; j++) {
      var meta = metaData[j];

      if (meta.name === ret.keyword && meta.value === ret.text) {
        chunks.splice(i, 1);
        break;
      }
    }
  } // insert meta


  for (var _i = 0; _i < metaData.length; _i++) {
    var _meta = metaData[_i];
    var value = _meta.value;

    if (value.length === 0) {
      value = 'null';
    }

    chunks.splice(-1, 0, pngChunkText.encode(_meta.name, value));
  }

  var arrayBuffer = pngChunksEncode(chunks);
  if (outputFormat === 'binaryString') return convertToBinaryString$3(arrayBuffer);
  if (outputFormat === 'base64') return btoa_1(convertToBinaryString$3(arrayBuffer));
  if (outputFormat === 'dataUrl') return "data:image/png;base64,".concat(btoa_1(convertToBinaryString$3(arrayBuffer)));
  if (outputFormat === 'buffer') return arrayBuffer;
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
    throw new Error('`writeMeta` got invalid arguments');
  }

  switch (mimeType) {
    case 'image/jpeg':
      return jpeg$1(data, metaData, outputFormat);

    case 'image/png':
      return png$1(data, metaData, outputFormat);

    default:
      throw new Error('unsupported mimeType: ', mimeType);
  }
}

var writeMeta_1 = writeMeta;

var src = {
  readMeta: readMeta_1,
  writeMeta: writeMeta_1
};
var src_1 = src.readMeta;
var src_2 = src.writeMeta;

exports.default = src;
exports.readMeta = src_1;
exports.writeMeta = src_2;
//# sourceMappingURL=index.cjs.js.map
