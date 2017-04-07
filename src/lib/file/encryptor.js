const fs = require('graceful-fs')
const crypto = require('crypto')
const Tempfile = require('./tempfile')
const Key = require('./key')

class FileEncryptor {
  constructor (file) {
    this.tempfile = new Tempfile()
  }

  encrypt (encryptionKey) {
    return new Promise((resolve, reject) => {
      // if encryption is disabled, just resolve this promise
      if (!this.folder.useEncryptionForProvider(this.provider)) {
        this.debug('provider is not configured to use encryption')
        resolve()
      } else if (encryptionKey) {
        this._encrypt(resolve, reject, encryptionKey)
      } else {
        this.getEncryptionKey().then(
          (encryptionKey) => this._encrypt(resolve, reject, encryptionKey),
          (err) => reject(err)
        )
      }
    })
  }

  _encrypt (resolve, reject, encryptionKey) {
    // validate encryption key given
    if (typeof encryptionKey !== 'string' || encryptionKey.length < 30) {
      return reject(new Error('InvalidEncryptionKey'))
    }

    this.debug.obfuscate('beginning encryption, with key: %s', encryptionKey)

    const algo = this.folder.getCipher(this.provider)
    const cipher = crypto.createCipher(algo, encryptionKey)
    const readStream = this.readStream.setEncoding('utf8')
    cipher.setEncoding('base64')

    readStream.pipe(cipher).pipe(this.tempfile.writeStream).on('close', () => {
      this.debug('encryption finished, encrypted file: %s', this.tempfile.location)

      // stat the completed enctypted file, so we can get the file length
      fs.stat(this.tempfile.location, (err, stats) => {
        this.debug('encrypted temp file stated')
        if (err) return reject(err)
        this.tempfile.stats = stats
        resolve()
      })
    })
  }

  decrypt (encryptionKey) {
    return new Promise((resolve, reject) => {
      const _decrypt = function _decrypt (encryptionKey) {
        // validate encryption key given
        if (typeof encryptionKey !== 'string' || encryptionKey.length < 30) {
          return reject(new Error('InvalidEncryptionKey'))
        }

        this.debug.obfuscate('beginning decryption, with key: %s', encryptionKey)
        this.debug('decrypting %s', this.writeTempFile.location)

        const algo = this.folder.getCipher(this.provider)
        const decipher = crypto.createDecipher(algo, encryptionKey)
        const readStream = this.writeTempFile.readStream.setEncoding('base64')

        const decryptedTempfile = new Tempfile()
        const writeStream = decryptedTempfile.writeStream
        const pipe1 = readStream.pipe(decipher)

        pipe1.on('error', (err) => {
          console.log('error 1!', err)
        })
        pipe1.setEncoding('utf8')

        const pipe = pipe1.pipe(writeStream)

        pipe.on('error', (err) => {
          console.log('error 2!', err)
        })

        pipe.on('close', () => {
          this.debug('decryption finished, plaintext file: %s', decryptedTempfile.location)

          // stat the completed enctypted file, so we can get the file length
          fs.stat(this.tempfile.location, (err, stats) => {
            this.debug('encrypted temp file stated')
            if (err) return resolve(err)
            this.tempfile.stats = stats
            resolve()
          })
        })
      }.bind(this)

      // if encryption is disabled, just resolve this promise
      if (!this.folder.useEncryptionForProvider(this.provider)) {
        this.debug('provider is not configured to use encryption')
        resolve()
      } else if (encryptionKey) {
        _decrypt(encryptionKey)
      } else {
        this.getEncryptionKey().then(
          (encryptionKey) => _decrypt(encryptionKey),
          (err) => reject(err)
        )
      }
    })
  }

  getEncryptionKey (encoding = 'hex') {
    return new Promise((resolve, reject) => {
      // if encryption is disabled, just resolve this promise
      if (!this.folder.useEncryptionForProvider(this.provider)) {
        return resolve()
      }

      // derive file-unique encryption key
      this.folder.getEncryptionKey(this.provider).then(
        (secret) => {
          const salt = 'salt'
          const key = new Key(secret, salt)
          key.derive().then((encKey) => {
            resolve(encKey.toString(encoding))
          }, reject)
        },
        (err) => reject(err)
      )
    })
  }
}

module.exports = FileEncryptor
