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

  static get tempfile () {
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
        this.debug('file stat finsihed')
        this.stats = stats
        resolve(stats)
      })
    })
  }

  encrypt () {
    return new Promise((resolve, reject) => {
      if (!this.folder.options.encrypt) {
        return resolve()
      }

      const algo = this.folder.options.encrypt.cipher || 'aes128'
      const key = this.folder.options.encrypt.key
      const cipher = crypto.createCipher(algo, key)
      cipher.setEncoding('base64') // or hex?

      this.tempfile = File.tempfile
      this.debug('beginning encryption')
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
}

module.exports = File
