const WORD_SEPARATOR = '~_'
const META_SEPARATOR = '_|'
const SIG = 'Mt_'

function encodeMetadata (metadata) {
  return metadata.map(meta => {
    return `${meta.value}`
  }).join("")
}

function decodeMetadata (string) {
  if (!string.startsWith(SIG)) return string
  return string.slice(SIG.length).split(META_SEPARATOR).map(metaStr => {
    let [name, value] = metaStr.split(WORD_SEPARATOR)
    return {name: unescape(name), value: unescape(value)}
  })
}

module.exports = {
  encodeMetadata,
  decodeMetadata,
}