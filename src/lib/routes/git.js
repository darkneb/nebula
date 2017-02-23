const debug = require('../debug')(__filename)

const Git = require('../git')

let self = new Git()
let handlers = []

module.exports = function (req, res) {
  debug('git request made: %s', req.url)
  res.setHeader('connection', 'close')

  function next (ix) {
    debug('handler %s', 0)
    var x = handlers[ix].call(self, req, res)
    if (x === false) {
      next(ix + 1)
    }
  }

  next(0)
}

handlers.push(require('./git-info-refs'))
handlers.push(require('./git-head'))
handlers.push(require('./git-post'))

handlers.push(function (req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.statusCode = 405
    res.end('method not supported')
  } else {
    return false
  }
})

handlers.push(function (req, res) {
  res.statusCode = 404
  res.end('not found')
})
