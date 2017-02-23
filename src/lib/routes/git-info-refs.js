const debug = require('../debug')(__filename)
const qs = require('querystring')
const url = require('url')
const httpDuplex = require('http-duplex')
const spawn = require('child_process').spawn
var noCache = require('./utils/no-cache')

module.exports = function (appConfig) {
  return function (req, res) {
    debug('handler 0')

    if (req.method !== 'GET') {
      debug('request is not a GET, so cannot be for /info/refs')
      return false
    }

    let self = this
    var u = url.parse(req.url)
    var m = u.pathname.match(/\/(.+)\/info\/refs$/)
    if (!m) {
      debug('request is not for /info/refs')
      return false
    }
    if (/\.\./.test(m[1])) {
      debug('attempting to traverse file structure')
      return false
    }

    var repo = m[1]
    var params = qs.parse(u.query)

    if (!params.service) {
      debug('service parameter missing, git over dummy-html is not supported')
      res.statusCode = 400
      res.end('service parameter required')
      return
    }

    var service = params.service.replace(/^git-/, '')
    if (self.services.indexOf(service) < 0) {
      debug('does not support service %s', service)
      res.statusCode = 405
      res.end('service not available')
      return
    }

    infoResponse({
      repos: self,
      repo: repo,
      service: service
    }, req, res)
  }
}

function infoResponse (opts, req, res) {
  debug('info response started')
  var self = opts.repos
  var dup = httpDuplex(req, res)
  dup.cwd = self.dirMap(opts.repo)
  dup.repo = opts.repo

  dup.accept = dup.emit.bind(dup, 'accept')
  dup.reject = dup.emit.bind(dup, 'reject')

  dup.once('reject', function (code) {
    res.statusCode = code || 500
    res.end()
  })

  var anyListeners = self.listeners('info').length > 0

  self.exists(opts.repo, function (ex) {
    debug('exists? %s', ex)
    dup.exists = ex

    if (!ex && self.autoCreate) {
      dup.once('accept', function () {
        self.create(opts.repo, next)
      })

      self.emit('info', dup)
      if (!anyListeners) dup.accept()
    } else if (!ex) {
      res.statusCode = 404
      res.setHeader('content-type', 'text/plain')
      res.end('repository not found')
    } else {
      dup.once('accept', next)
      self.emit('info', dup)

      if (!anyListeners) dup.accept()
    }
  })

  function next () {
    res.setHeader(
      'content-type',
      'application/x-git-' + opts.service + '-advertisement'
    )
    noCache(res)
    var d = self.dirMap(opts.repo)
    serviceRespond(self, opts.service, d, res)
  }
}

function serviceRespond (self, service, file, res) {
  function pack (s) {
    var n = (4 + s.length).toString(16)
    return Array(4 - n.length + 1).join('0') + n + s
  }
  res.write(pack('# service=git-' + service + '\n'))
  res.write('0000')

  var cmd = [ 'git-' + service, '--stateless-rpc', '--advertise-refs', file ]
  var ps = spawn(cmd[0], cmd.slice(1))
  ps.on('error', function (err) {
    self.emit('error', new Error(
            err.message + ' running command ' + cmd.join(' ')
        ))
  })
  ps.stdout.pipe(res)
}
