const fs = require('graceful-fs')
const crypto = require('crypto')
const Tempfile = require('./tempfile')

class FileEncryptor {
  constructor (file) {
    this.tempfile = new Tempfile()
  }

  encrypt (encryptionKey) {
    return new Promise((resolve, reject) => {
      const _encrypt = function _encrypt (encryptionKey) {
        // validate encryption key given
        if (typeof encryptionKey !== 'string' || encryptionKey.length < 30) {
          return reject(new Error('InvalidEncryptionKey'))
        }

        this.debug.obfuscate('beginning encryption, with key: %s', encryptionKey)

        const algo = this.folder.getCipher(this.provider)
        const cipher = crypto.createCipher(algo, encryptionKey)
        cipher.setEncoding('base64') // or hex?

        this.file.stream.pipe(cipher).pipe(this.tempfile.writeStream).on('close', () => {
          this.debug('encryption finished, encrypted file: %s', this.tempfile.location)

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
        _encrypt(encryptionKey)
      } else {
        this.getEncryptionKey().then(
          (encryptionKey) => _encrypt(encryptionKey),
          (err) => reject(err)
        )
      }
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

        const algo = this.folder.getCipher(this.provider)
        const decipher = crypto.createDecipher(algo, encryptionKey)
        // decipher.setEncoding('base64') // or hex?

        const decryptedTempfile = new Tempfile()

        this.tempfile.readStream.pipe(decipher).pipe(decryptedTempfile.writeStream).on('close', () => {
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
          // validate secret
          if (typeof secret !== 'string') {
            return reject(new Error('InvalidEncryptionSecret'))
          }

          // transform secret into a Buffer
          this.debug.obfuscate('kdf using secret: %s', secret)
          secret = Buffer.from(secret)

          // create salt
          const salt = 'salt'
          this.debug.obfuscate('kdf using salt  : %s', salt)

          // now derive!
          crypto.pbkdf2(secret, salt, 100000, 512, 'sha512', (err, key) => {
            if (err) return reject(err)
            const encryptionKey = key.toString(encoding)
            this.debug.obfuscate('derived encryption key: %s', encryptionKey)
            resolve(encryptionKey)
          })
        },
        (err) => reject(err)
      )
    })
  }
}

module.exports = FileEncryptor
