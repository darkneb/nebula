const debug = require('../lib/debug')(__filename)
const path = require('path')
const connect = require('connect')
const http = require('http')
const serveStatic = require('serve-static')

module.exports = function (appConfig) {
  debug('starting web server at %s', appConfig.serverUri)
  const app = connect()

  // parse urlencoded request bodies into req.body
  // var bodyParser = require('body-parser');
  // app.use(bodyParser.urlencoded({extended: false}));

  // add a simple logger for non-static file requests
  app.use(function (req, res, next) {
    debug('request: %s', req.url)
    next()
  })

  // git security check, prevent file system traversing
  app.use(function (req, res, next) {
    if (req.url.includes('..')) {
      res.statusCode = 404
      res.end()
    } else {
      next()
    }
  })

  // handle other git requests
  app.use('/git/info/refs', require('../lib/routes/git-info-refs')(appConfig))
  app.use('/git', require('../lib/routes/git'))

  app.use('/config/save', function (req, res) {
    res.end(JSON.stringify({
      success: true
    }))
  })

  // global error handling
  app.use(function onerror (err, req, res, next) {
    debug('error!')
    console.error(err)
    res.statusCode = 500
    res.end('Unexpected Error')
  })

  // static files
  const staticRoot = path.resolve(__dirname, '../../web/webroot')
  app.use(serveStatic(staticRoot, {
    'index': ['index.html']
  }))

  // create node.js http server and listen on port
  http.createServer(app).listen(appConfig.serverPort)
}
