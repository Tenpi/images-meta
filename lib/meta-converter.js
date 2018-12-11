const WORD_SEPARATOR = '~_'
const META_SEPARATOR = '_|'
const SIG = 'Mt_'

function encodeMetadata (metadata) {
  return SIG + metadata.map(meta => {
    return `${meta.name}${WORD_SEPARATOR}${meta.value}`
  }).join(META_SEPARATOR)
}

function decodeMetadata (string) {
  if (!string.startsWith(SIG)) return string
  return string.slice(SIG.length).split(META_SEPARATOR).map(metaStr => {
    let [name, value] = metaStr.split(WORD_SEPARATOR)
    return {name, value}
  })
}

module.exports = {
  encodeMetadata,
  decodeMetadata,
}