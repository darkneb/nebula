const path = require('path')
const fs = require('graceful-fs')
const checksum = require('checksum')

class File {
  constructor (path, stats, folder) {
    this.path = path
    this.stats = stats
    this.folder = folder
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

  get stream () {
    return fs.createReadStream(this.abs)
  }

  /**
   * Resolves an fs.Stats object
   * @see https://nodejs.org/api/fs.html#fs_class_fs_stats
   */
  stat () {
    return new Promise((resolve, reject) => {
      if (this.stats) {
        return resolve(this.stats)
      }

      fs.stat(this.abs, (err, stats) => {
        if (err) return reject(err)
        this.stats = stats
        resolve(stats)
      })
    })
  }

  md5 () {
    return this.checksum('md5')
  }

  sha1 () {
    return this.checksum('sha1')
  }

  checksum () {
    return new Promise((resolve, reject) => {
      checksum.file(this.abs, function (err, sum) {
        if (err) return reject(err)
        resolve(sum)
      })
    })
  }
}

module.exports = File
