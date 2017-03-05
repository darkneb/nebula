const crypto = require('crypto')

const checksum = function (stream, algorithm, encoding = 'hex') {
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

/**
 * Create an md5 checksum of this file, or the provided stream
 *
 * Verify to command line outputs:
 *   hex:
 *     openssl md5 file.txt
 *   base64:
 *     openssl md5 -binary file.txt  | openssl enc -base64
 *
 * @param {FileStream} stream Optionally provide the file stream, defaults to this.stream
 * @param {string} encoding Encoding to use, such as 'base65'; default: 'hex'
 */
for (const algo of ['md5', 'sha1']) {
  checksum[algo] = function (stream, encoding) {
    return checksum(stream, algo, encoding)
  }
}

module.exports = checksum
