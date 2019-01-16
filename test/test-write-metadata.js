const path = require('path')
const fs = require('fs-extra')
const assert = require('power-assert')
const { readMeta, writeMeta } = require('../src')
// const { assertMetadata } = require('./_helper')
const DATAURLS = require('./resource/dataUrls')

let MetadataArr = [
  {name: 'owner', value: 'linglong'},
  {name: 'time', value: new Date().toISOString()},
  {name: 'tpl_id', value: '5bfc072994b5dca6618f230b'},
  {name: '全中文测试', value: '全中文测试'},
  {name: '一些中文 chinese name', value: 'some chinese 中文'},
  {name: '一些中文 chinese name', value: 'some chinese 中文'},
  {name: '一些中文 chinese name', value: '全中文'},
  {name: '全中文', value: '一些中文 chinese name'},
]

let outputDir = path.join(__dirname, 'tmp')

let outputFormats = ['base64', 'binaryString', 'buffer', 'dataUrl']

describe('writeMeta()', () => {
  before(() => {
    try { fs.removeSync(outputDir) } catch (e) {
      // do nothing
    }
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
        assert(['owner', 'time'].every(name => metadata.find(item => item.name === name)))
        assert(metadata.length === 15)
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
        assert(['owner', 'time'].every(name => metadata.find(item => item.name === name)))
        assert(metadata.length === 7)
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
        assert(metadata.length === 12)
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
        assert(metadata.length === 6)
      }
    }
  })

  it('should overwrite metadata with written PNG file', () => {
    let buffer = fs.readFileSync(path.join(__dirname, 'resource', 'pic_with_meta.png'))
    let newBuffer = writeMeta(buffer, 'image/png', MetadataArr, 'buffer')
    let metadata = readMeta(newBuffer, 'image/png')
    assert(metadata.length === 7)
  })

  it('should overwrite metadata with written JPEG file', () => {
    let buffer = fs.readFileSync(path.join(__dirname, 'resource', 'pic_with_meta.jpeg'))
    let newBuffer = writeMeta(buffer, 'image/jpeg', MetadataArr, 'buffer')
    let metadata = readMeta(newBuffer, 'image/jpeg')
    assert(metadata.length === 9)
  })
})
