const debug = require('../debug')(__filename)
const GitRepo = require('../git-repo')
const spawn = require('child_process').spawn
const through = require('through')
const zlib = require('zlib')

module.exports = function (appConfig) {
  return function (req, res) {
    debug('request %s: %s', req.method, req.url)

    let service = req.params.service.replace(/^git-/, '')
    debug('repo %s, service %s', req.params.repo, service)

    if (GitRepo.supportedServices.indexOf(service) < 0) {
      debug('git service requested %s is unsupported', service)
      return res.sendStatus(405).end()
    }

    res.setHeader('content-type', 'application/x-git-' + service + '-result')
    res.disableCache()

    let opts = {
      service: service,
      cwd: req.folder.gitLocation
    }

    let buffered = through().pause()

    // stream needed to receive data after decoding, but before accepting
    let ts = through()

    let decoder = encodings[req.headers['content-encoding']]
    if (decoder) {
      debug('using decoder %s', decoder)
      // data is compressed with gzip or deflate
      req.pipe(decoder()).pipe(ts).pipe(buffered)
    } else {
      debug('data is not compressed')
      // data is not compressed
      req.pipe(ts).pipe(buffered)
    }

    let data = ''
    let last
    let commit
    ts.once('data', function (buf) {
      debug('data received')
      data += buf

      var ops = data.match(new RegExp(headerRE[service], 'gi'))
      if (!ops) return
      data = undefined

      ops.forEach(function (op) {
        var m = op.match(new RegExp(headerRE[service]))
        let eventName

        if (service === 'receive-pack') {
          last = m[1]
          commit = m[2]
          let type

          if (m[3] === 'heads') {
            type = 'branch'
            eventName = 'push'
          } else {
            type = 'version'
            eventName = 'tag'
          }

          var headers = {
            last: last,
            commit: commit
          }
          headers[type] = m[4]
          // self[type] = m[4] // this.branch this.version
        } else if (service === 'upload-pack') {
          commit = m[1]
          eventName = 'fetch'
        }

        req.folder.git.emit(eventName, res, res)
        next()
      })
    })

    function next () {
      debug('called next')
      process.nextTick(function () {
        debug('process.nextTick')
        var cmd = [ 'git-' + opts.service, '--stateless-rpc', req.folder.gitLocation ]
        var ps = spawn(cmd[0], cmd.slice(1))
        ps.on('error', function (err) {
          debug('git threw an error')
          console.log(err)
          // self.emit('error', new Error(
          //   err.message + ' running command ' + cmd.join(' ')
          // ))
        })

        // self.emit('service', ps)

        var respStream = through(
          function (c) {
            // if (self.listeners('response').length === 0) {
              return this.queue(c)
            // }

            // prevent git from sending the close signal
            // if (c.length === 4 && c.toString() === '0000') {
            //   return
            // }
            //
            // this.queue(c)
          },
          function () {
            // if (self.listeners('response').length > 0) {
            //   return
            // }
            this.queue(null)
          }
        )

        // function endResponse () {
        //   res.queue(new Buffer('0000'))
        //   res.queue(null)
        // }

        // self.emit('response', respStream, endResponse)
        ps.stdout.pipe(respStream).pipe(res)

        buffered.pipe(ps.stdin)
        buffered.resume()
        ps.on('exit', function () {
          debug('process ends')
        })
      })
    }
  }
}

var encodings = {
  'gzip': function () { return zlib.createGunzip() },
  'deflate': function () { return zlib.createDeflate() }
}

var headerRE = {
  'receive-pack': '([0-9a-fA-F]+) ([0-9a-fA-F]+)' +
    ' refs/(heads|tags)/(.*?)( |00|\u0000)' +
    '|^(0000)$',
  'upload-pack': '^\\S+ ([0-9a-fA-F]+)'
}
