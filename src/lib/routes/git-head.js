const debug = require('../debug')(__filename)
const fs = require('graceful-fs')
const path = require('path')
const url = require('url')
const httpDuplex = require('http-duplex')

module.exports = function (req, res) {
  if (req.method !== 'GET') {
    debug('request is not GET, cannot be for /HEAD')
    return false
  }

  let self = this
  var u = url.parse(req.url)
  var m = u.pathname.match(/^\/(.+)\/HEAD$/)
  if (!m) {
    debug('request not for /HEAD')
    return false
  }
  if (/\.\./.test(m[1])) {
    debug('attempting to traverse file system')
    return false
  }

  var repo = m[1]

  var next = function (x) {
    var file = self.dirMap(path.join(m[1], 'HEAD'));
    (fs.exists || path.exists)(file, function (ex) {
      if (ex) fs.createReadStream(file).pipe(res)
      else {
        res.statusCode = 404
        res.end('not found')
      }
    })
  }

  self.exists(repo, function (ex) {
    debug('does repo exist? %s', ex)
    var anyListeners = self.listeners('head').length > 0
    var dup = httpDuplex(req, res)
    dup.exists = ex
    dup.repo = repo
    dup.cwd = self.dirMap(repo)

    dup.accept = dup.emit.bind(dup, 'accept')
    dup.reject = dup.emit.bind(dup, 'reject')

    dup.once('reject', function (code) {
      dup.statusCode = code || 500
      dup.end()
    })

    if (!ex && self.autoCreate) {
      dup.once('accept', function (dir) {
        self.create(dir || repo, next)
      })
      self.emit('head', dup)
      if (!anyListeners) dup.accept()
    } else if (!ex) {
      res.statusCode = 404
      res.setHeader('content-type', 'text/plain')
      res.end('repository not found')
    } else {
      dup.once('accept', next)
      self.emit('head', dup)
      if (!anyListeners) dup.accept()
    }
  })
}
