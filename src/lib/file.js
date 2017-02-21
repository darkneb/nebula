const path = require('path')
const fs = require('graceful-fs')
const crypto = require('crypto')
const checksum = require('./file/checksum')

class File {
  constructor (path, stats, folder) {
    this.path = path
    this.stats = stats
    this.folder = folder
    this.debug = require('./debug')(__filename, this.name)
  }

  get abs () {
    return this.path
  }

  get name () {
    return path.basename(this.path)
  }

  get ext () {
    return path.extname(this.name())
  }

  get type () {
    return 'text/plain'
    // return this.folder.options.encrypt ? 'text/plain' : 'text/plain'
  }

  get encoding () {
    return 'utf8'
    // return this.folder.options.encrypt ? 'utf8' : 'utf8'
  }

  get plainStream () {
    return fs.createReadStream(this.abs)
  }

  get stream () {
    if (this.tempfile) {
      return this.tempfile.read()
    } else {
      return this.plainStream
    }
  }

  static tempfile () {
    const tempfile = '/tmp/syncstuff-temp'
    return {
      path: tempfile,
      stream: fs.createWriteStream(tempfile, {
        // flags: RDWR_EXCL,
        mode: '0600'
      }),
      read () {
        return fs.createReadStream(tempfile)
      }
    }
  }

  /**
   * Resolves an fs.Stats object
   * @see https://nodejs.org/api/fs.html#fs_class_fs_stats
   */
  stat () {
    return new Promise((resolve, reject) => {
      if (this.stats) {
        this.debug('using known file stats')
        return resolve(this.stats)
      }

      fs.stat(this.abs, (err, stats) => {
        if (err) return reject(err)
        if (!stats.isFile()) {
          this.debug('not a file')
          return reject(new Error('Not a file'))
        }
        this.debug('stat finished')
        this.stats = stats
        resolve(stats)
      })
    })
  }

  encrypt (encryptionKey) {
    return new Promise((resolve, reject) => {
      // if this file is not supposed to be encrypted, just resolve the promise
      if (!this.folder.useEncryption) {
        this.debug('encryption is not necessary')
        return resolve()
      }

      // validate encryption key given
      if (typeof encryptionKey !== 'string' || encryptionKey.length < 30) {
        return reject(new Error('InvalidEncryptionKey'))
      }

      this.debug.obfuscate('beginning encryption, with key: %s', encryptionKey)

      const algo = this.folder.options.encrypt.cipher || 'aes128'
      const cipher = crypto.createCipher(algo, encryptionKey)
      cipher.setEncoding('base64') // or hex?

      this.tempfile = File.tempfile()
      this.plainStream.pipe(cipher).pipe(this.tempfile.stream).on('close', () => {
        this.debug('encryption finished')

        // stat the completed enctypted file, so we can get the file length
        fs.stat(this.tempfile.path, (err, stats) => {
          this.debug('encrypted temp file stated')
          if (err) return resolve(err)
          this.tempfile.stats = stats
          resolve()
        })
      })
    })
  }

  getEncryptionKey (encoding = 'hex') {
    return new Promise((resolve, reject) => {
      // if this file is not supposed to be encrypted, just resolve the promise
      if (!this.folder.useEncryption) {
        return resolve()
      }

      // derive file-unique encryption key
      this.folder.getEncryptionKey().then(
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

  md5 (stream, encoding) {
    return this.checksum('md5', stream, encoding)
  }

  sha1 (stream, encoding) {
    return this.checksum('sha1', stream)
  }

  checksum (algorithm, stream = this.plainStream, encoding) {
    this.debug('creating checksum using algo: %s', algorithm)
    let promise = checksum(stream, algorithm, encoding)
    promise.then((checksum) => {
      this.debug('checksum: %s', checksum)
    })
    return promise
  }

  cleanupTempfile () {
    return new Promise((resolve, reject) => {
      // if no temp file was used, we have nothing to remove
      if (!this.tempfile) return resolve()

      // remove the tempfile from disk
      fs.unlink(this.tempfile.path, () => {
        // we don't care if this file failed to remove
        // if (err) return reject(err)
        resolve()
      })
    })
  }
}

module.exports = File
