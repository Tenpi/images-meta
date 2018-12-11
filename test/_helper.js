const assert = require('power-assert')

async function assertThrowsAsync(fn, regExp) {
  let f = () => {}
  try {
    await fn()
  } catch(e) {
    f = () => {throw e}
  } finally {
    assert.throws(f, regExp)
  }
}

function assertMetadata (metadata, compared) {
  console.log('metadata:', metadata)
  assert.ok(Array.isArray(metadata))
  if (metadata.length > 0) {
    let keys = Object.keys(metadata[0])
    assert.ok(keys.includes('name'), keys.includes('value'))
  }

  if (compared) {
    for (let meta of compared) {
      assert(metadata.find(({name, value}) => name === meta.name && value === meta.value))
    }
  }
}

module.exports = {
  assertThrowsAsync,
  assertMetadata,
}