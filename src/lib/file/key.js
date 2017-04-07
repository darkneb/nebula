const crypto = require('crypto')
const debug = require('../debug')(__filename)

class Key {
  constructor (secret, salt) {
    this.secret = secret
    this.salt = salt
    this.iterations = 100000
    this.keyLength = 512
    this.digestFunction = 'sha512'

    debug.obfuscate('kdf secret: %s ; salt: %s', secret, salt)
  }

  derive () {
    return new Promise((resolve, reject) => {
      // validate the secret
      if (typeof this.secret !== 'string') {
        return reject(new Error('InvalidEncryptionSecret'))
      }

      // transform secret into a Buffer
      const secret = Buffer.from(this.secret)

      crypto.pbkdf2(secret, this.salt, this.iterations, this.keyLength, this.digestFunction, (err, key) => {
        if (err) return reject(err)
        // const encryptionKey = key.toString(encoding)
        // this.debug.obfuscate('derived encryption key: %s', key.toString('hex'))
        resolve(key)
      })
    })
  }
}

module.exports = Key
