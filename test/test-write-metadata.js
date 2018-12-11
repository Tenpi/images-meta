const path = require('path')
const fs = require('fs-extra')
const { readMeta, writeMeta } = require('../')
const { assertMetadata } = require('./_helper')
const DATAURLS = require('./resource/dataUrls')

let MetadataArr = [
  {name: 'owner', value: 'linglong'},
  {name: 'time', value: new Date().toISOString()},
  {name: 'tpl_id', value: '5bfc072994b5dca6618f230b'},
]

let outputDir = path.join(__dirname, 'tmp')

let outputFormats = ['base64', 'binaryString', 'buffer', 'dataUrl']

describe('writeMeta()', () => {
  before(() => {
    try { fs.removeSync(outputDir) } catch (e) {}
    try {
      fs.mkdirSync(outputDir)
    } catch (e) {
      if (e && e.errno === -17) return
      throw e
    }
  })
  
  it('should write metadata with valid JPEG file', () => {
    let buffer = fs.readFileSync(path.join(__dirname, 'resource', 'pic.jpg'))

    for (let format of outputFormats) {
      let result = writeMeta(buffer, 'image/jpeg', MetadataArr, format)
      if (format === 'buffer') {
        let file = path.join(outputDir, `pic1_${format}.jpg`)
        fs.writeFileSync(file, result)
        let metadata = readMeta(fs.readFileSync(file), 'image/jpeg')
        assertMetadata(metadata, MetadataArr)
      }
    }
  })

  it('should write metadata with valid PNG file', () => {
    let buffer = fs.readFileSync(path.join(__dirname, 'resource', 'pic.png'))

    for (let format of outputFormats) {
      let result = writeMeta(buffer, 'image/png', MetadataArr, format)
      if (format === 'buffer') {
        let file = path.join(outputDir, `pic1_${format}.png`)
        fs.writeFileSync(file, result)
        let metadata = readMeta(fs.readFileSync(file), 'image/png')
        assertMetadata(metadata, MetadataArr)
      }
    }
  })

  it('should write metadata with valid JPEG dataUrl', () => {
    let buffer = DATAURLS.JPEG

    for (let format of outputFormats) {
      let result = writeMeta(buffer, 'image/jpeg', MetadataArr, format)
      if (format === 'buffer') {
        let file = path.join(outputDir, `pic2_${format}.jpg`)
        fs.writeFileSync(file, result)
        let metadata = readMeta(fs.readFileSync(file), 'image/jpeg')
        assertMetadata(metadata, MetadataArr)
      }
    }
  })

  it('should write metadata with valid PNG dataUrl', () => {
    let buffer = DATAURLS.PNG

    for (let format of outputFormats) {
      let result = writeMeta(buffer, 'image/png', MetadataArr, format)
      if (format === 'buffer') {
        let file = path.join(outputDir, `pic2_${format}.png`)
        fs.writeFileSync(file, result)
        let metadata = readMeta(fs.readFileSync(file), 'image/png')
        assertMetadata(metadata, MetadataArr)
      }
    }
  })
})
