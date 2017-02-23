const debug = require('./debug')(__filename)
const fs = require('graceful-fs')
const path = require('path')
const mkdirp = require('mkdirp')
const nodegit = require('nodegit')
const Events = require('./events')

class Git extends Events {
  constructor (repoLocation) {
    super()
    this.repoLocation = repoLocation
    this.baseGitRepo = false
  }

  exists (repo, cb) {
    (fs.exists || path.exists)(this.repoLocation, cb)
  }

  mkdir (dir, cb) {
    mkdirp(this.repoLocation, cb)
  }

  create (repo, cb) {
    return new Promise((resolve, reject) => {
      this.exists(repo, (ex) => {
        if (!ex) {
          this.mkdir(repo, next)
        } else {
          next()
        }
      })

      var next = function (err) {
        if (err) {
          return cb(err)
        }

        nodegit.Repository.init(this.repoLocation, this.baseGitRepo).then(
          (repo) => {
            console.log(repo)
            debug('new repo %s created', '')
            cb()
          },
          (err) => cb(err)
        )
      }.bind(this)
    })
  }

  static get supportedServices () {
    return ['upload-pack', 'receive-pack']
  }
}

module.exports = Git
