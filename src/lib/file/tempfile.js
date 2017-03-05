const fs = require('graceful-fs')
const uuid = require('uuid/v4')

class Tempfile {
  constructor () {
    this.location = '/tmp/syncstuff-' + uuid()
  }

  get writeStream () {
    return fs.createWriteStream(this.location, {
      // flags: RDWR_EXCL,
      mode: '0600'
    })
  }

  get readStream () {
    return fs.createReadStream(this.location)
  }

  remove () {
    return new Promise((resolve, reject) => {
      fs.unlink(this.location, () => {
        // we don't care if this file failed to remove
        // if (err) return reject(err)
        resolve()
      })
    })
  }
}

module.exports = Tempfile
