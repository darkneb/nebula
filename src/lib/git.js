/**
 * This is a wrapper to port git's http commands
 * to git repos
 */

const debug = require('./debug')(__filename)
const fs = require('graceful-fs')
const path = require('path')
const EventEmitter = require('events').EventEmitter
const util = require('util')
const mkdirp = require('mkdirp')
const nodegit = require('nodegit')

class Git {
  constructor () {
    EventEmitter.call(this)
    this.reposLocation = '/tmp/repos'
    this.autoCreate = true

    // supported git services
    this.services = ['upload-pack', 'receive-pack']
  }

  dirMap (dir) {
    return path.join(this.reposLocation, dir)
  }

  list (cb) {
    fs.readdir(this.dirMap(), cb)
  }

  exists (repo, cb) {
    (fs.exists || path.exists)(this.dirMap(repo), cb)
  }

  mkdir (dir, cb) {
    mkdirp(this.dirMap(dir), cb)
  }

  create (repo, cb) {
    if (typeof cb !== 'function') {
      cb = function () {}
    }
    // var cwd = process.cwd()

    if (!/\.git$/.test(repo)) repo += '.git'

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

      var dir = this.dirMap(repo)

      nodegit.Repository.init(dir, true).then(
        (repo) => {
          console.log(repo)
          debug('new repo %s created', '')
          cb()
        },
        (err) => cb(err)
      )
    }.bind(this)
  }
}

util.inherits(Git, EventEmitter)

module.exports = Git
