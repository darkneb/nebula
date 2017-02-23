const debug = require('../debug')(__filename)
const noCache = require('./utils/no-cache')
const createAction = require('./service')

module.exports = function (req, res) {
  if (req.method !== 'POST') {
    debug('request is not a POST')
    return false
  }
  let self = this
  var m = req.url.match(/\/(.+)\/git-(.+)/)
  if (!m) return false
  if (/\.\./.test(m[1])) return false

  var repo = m[1]
  var service = m[2]

  if (self.services.indexOf(service) < 0) {
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
}
