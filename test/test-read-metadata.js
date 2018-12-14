const path = require('path')
const fs = require('fs')
const { assertMetadata } = require('./_helper')
const { readMeta } = require('../src')
const DATAURLS = require('./resource/dataUrls')

describe('readMeta()', () => {
  it('should return metadata with valid JPEG file', () => {
    let buffer = fs.readFileSync(path.join(__dirname, 'resource', 'pic.jpg'))
    let metadata = readMeta(buffer, 'image/jpeg')
    assertMetadata(metadata)
  })

  it('should return metadata with valid PNG file', () => {
    let buffer = fs.readFileSync(path.join(__dirname, 'resource', 'pic.png'))
    let metadata = readMeta(buffer, 'image/png')
    assertMetadata(metadata)
  })

  it('should return metadata with valid JPEG dataUrl', () => {
    let metadata = readMeta(DATAURLS.JPEG, 'image/jpeg')
    assertMetadata(metadata)
  })

  it('should return metadata with valid PNG dataUrl', () => {
    let metadata = readMeta(DATAURLS.PNG, 'image/png')
    assertMetadata(metadata)
  })
})
