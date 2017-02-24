const debug = require('../debug')(__filename)
const spawn = require('child_process').spawn
// const noCache = require('./utils/no-cache')
const GitRepo = require('../git-repo')

module.exports = function (appConfig) {
  return function (req, res) {
    debug('/info/refs request')

    if (!req.query.service) {
      debug('service parameter missing, git over dummy-html is not supported')
      res.status(400).send('service parameter required').end()
      return
    }

    let service = req.query.service.replace(/^git-/, '')
    if (GitRepo.supportedServices.indexOf(service) < 0) {
      debug('does not support service %s', service)
      return res.sendStatus(405).end()
    }

    debug('info response started for folder %s', req.folder.name)
    debug('git repo expected at %s', req.folder.gitLocation)

    res.setHeader('content-type', 'application/x-git-' + service + '-advertisement')
    res.disableCache()

    res.write(pack('# service=git-' + service + '\n'))
    res.write('0000')

    var cmd = [ 'git-' + service, '--stateless-rpc', '--advertise-refs', req.folder.gitLocation ]
    var ps = spawn(cmd[0], cmd.slice(1))

    ps.on('error', function (err) {
      debug('git threw an error')
      debug(err)
      // gitRepo.emit('error', new Error(
      //   err.message + ' running command ' + cmd.join(' ')
      // ))
    })

    ps.on('close', function (exitCode) {
      debug('process ended')
      console.log(arguments)
    })

    ps.stdout.pipe(res)
  }
}

function pack (s) {
  var n = (4 + s.length).toString(16)
  return Array(4 - n.length + 1).join('0') + n + s
}
