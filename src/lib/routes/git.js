const fs = require('fs')
const path = require('path')
const url = require('url')
const qs = require('querystring')
const debug = require('../debug')(__filename)
const EventEmitter = require('events').EventEmitter

const services = [ 'upload-pack', 'receive-pack' ]

const createAction = require('./service')
const noCache = require('./utils/no-cache')
const infoResponse = require('./info')
const httpDuplex = require('http-duplex')
const spawn = require('child_process').spawn

function onexit (ps, cb) {
  var pending = 3
  var code, sig

  function onend () {
    if (--pending === 0) cb(code, sig)
  }
  ps.on('exit', function (c, s) {
    code = c
    sig = s
  })
  ps.on('exit', onend)
  ps.stdout.on('end', onend)
  ps.stderr.on('end', onend)
}

class Git {
  constructor () {
    EventEmitter.call(this)
    this.repoDir = '/tmp/repos'
  }

  dirMap (dir) {
    return path.join(this.repoDir, dir)
  }

  list (cb) {
    fs.readdir(this.dirMap(), cb)
  }

  exists (repo, cb) {
    (fs.exists || path.exists)(this.dirMap(repo), cb)
  }

  mkdir (dir, cb) {
    // mkdirp(this.dirMap(dir), cb)
  }

  create (repo, cb) {
    if (typeof cb !== 'function') cb = function () {}
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
      var ps
      if (self.checkout) {
        ps = spawn('git', [ 'init', dir ])
      } else {
        ps = spawn('git', [ 'init', '--bare', dir ])
      }

      err = ''
      ps.stderr.on('data', function (buf) { err += buf })

      onexit(ps, function (code) {
        if (!cb) {
        } else if (code) {
          cb(err || true)
        } else {
          cb(null)
        }
      })
    }.bind(this)
  }
}

let self

module.exports = function (req, res) {
  debug('git request made')
  res.setHeader('connection', 'close')
  self = new Git();

  (function next (ix) {
    var x = handlers[ix].call(self, req, res)
    if (x === false) next(ix + 1)
  })(0)
}

var handlers = []
handlers.push(function (req, res) {
  if (req.method !== 'GET') return false

  var u = url.parse(req.url)
  var m = u.pathname.match(/\/(.+)\/info\/refs$/)
  if (!m) return false
  if (/\.\./.test(m[1])) return false

  var repo = m[1]
  var params = qs.parse(u.query)

  if (!params.service) {
    res.statusCode = 400
    res.end('service parameter required')
    return
  }

  var service = params.service.replace(/^git-/, '')
  if (services.indexOf(service) < 0) {
    res.statusCode = 405
    res.end('service not available')
    return
  }

  infoResponse({
    repos: self,
    repo: repo,
    service: service
  }, req, res)
})

handlers.push(function (req, res) {
  if (req.method !== 'GET') return false

  var u = url.parse(req.url)
  var m = u.pathname.match(/^\/(.+)\/HEAD$/)
  if (!m) return false
  if (/\.\./.test(m[1])) return false

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

    if (!ex /* && self.autoCreate */) {
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
})

handlers.push(function (req, res) {
  if (req.method !== 'POST') return false
  var m = req.url.match(/\/(.+)\/git-(.+)/)
  if (!m) return false
  if (/\.\./.test(m[1])) return false

  var repo = m[1]
  var service = m[2]

  if (services.indexOf(service) < 0) {
    res.statusCode = 405
    res.end('service not available')
    return
  }

  res.setHeader('content-type', 'application/x-git-' + service + '-result')
  noCache(res)

  var action = createAction({
    repo: repo,
    service: service,
    cwd: self.dirMap(repo)
  }, req, res)

  action.on('header', function () {
    var evName = action.evName
    var anyListeners = self.listeners(evName).length > 0
    self.emit(evName, action)
    if (!anyListeners) action.accept()
  })
})

handlers.push(function (req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.statusCode = 405
    res.end('method not supported')
  } else return false
})

handlers.push(function (req, res) {
  res.statusCode = 404
  res.end('not found')
})
