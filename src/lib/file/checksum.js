const crypto = require('crypto')

module.exports = function (stream, algorithm, encoding = 'hex') {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm)

    hash.setEncoding(encoding)
    stream.pipe(hash, { end: false })

    stream.on('end', () => {
      hash.end()
      resolve(hash.read())
    })
  })
}
