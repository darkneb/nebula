const path = require('path')
const fs = require('graceful-fs')
const checksum = require('./file/checksum')
const Encryptor = require('./file/encryptor')
const Tempfile = require('./file/tempfile')

class File extends Encryptor {
  constructor (location, stats, folder, provider) {
    super()

    if (!path.isAbsolute(location)) {
      throw new Error('Location is not absolute! ' + location)
    }

    this._location = location
    this.stats = stats
    this.folder = folder
    this.provider = provider
    this.debug = require('./debug')(__filename, this.name)
  }

  // returns the absolute location of the non-encrypted file
  get location () {
    return this._location
  }

  // returns the object key that should be used by storage providers
  get key () {
    return path.join(this.folder.get(['providers', this.provider.get('id'), 'path']), this.relative)
  }

  // returns the file's relative path to the .git folder
  get relative () {
    return path.relative(this.folder.gitLocation, this.location)
  }

  get name () {
    return path.basename(this.location)
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

  get size () {
    return this.tempfile ? this.tempfile.stats.size : this.stats.size
  }

  get readStream () {
    return fs.createReadStream(this.location)
  }

  tempWriteStream () {
    this.writeTempFile = new Tempfile()
    return this.writeTempFile.writeStream
  }

  get stream () {
    if (this.tempfile) {
      return this.tempfile.readStream
    } else {
      return this.readStream
    }
  }

  // returns whether this file will be encrypted before being uploaded
  get encrypted () {
    return this.folder.useEncryptionForProvider(this.provider)
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

      fs.stat(this.location, (err, stats) => {
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

  checksum (algorithm, encoding, stream = this.stream) {
    return checksum(stream, algorithm, encoding)
  }

  cleanup () {
    return new Promise((resolve, reject) => {
      // if no temp file was used, we have nothing to remove
      if (!this.tempfile) return resolve()

      // if there was a temo file, remove it
      this.tempfile.remove().then(resolve, reject)
    })
  }
}

module.exports = File
