const debug = require('../lib/debug')(__filename)
const path = require('path')
const express = require('express')
const http = require('http')
const serveStatic = require('serve-static')

module.exports = function (appConfig) {
  debug('starting web server at %s', appConfig.serverUri)
  const app = express()
  const staticRoot = path.resolve(__dirname, '../../web/webroot')

  app.use('/web', express.static(staticRoot))

  // parse urlencoded request bodies into req.body
  // var bodyParser = require('body-parser');
  // app.use(bodyParser.urlencoded({extended: false}));

  // add a simple logger for non-static file requests
  app.use(function (req, res, next) {
    debug('request: %s', req.url)
    next()
  })

  // git security check, prevent file system traversing
  app.use('/git/:repo', function (req, res, next) {
    req.folderId = req.params.repo.replace(/\.git$/, '')
    if (req.url.includes('..')) {
      debug('attempt to traverse file system prevented')
      res.sendStatus(404).end()
    } else if (req.method !== 'GET' && req.method !== 'POST') {
      debug('attempt to use unsupported request method %s', req.method)
      res.sendStatus(405).end()
    } else if ((req.folder = appConfig.getFolderById(req.folderId)) == null) {
      debug('folder does not exist')
      res.sendStatus(404).end()
    } else {
      // disable caching for all git responses
      res.disableCache = function () {
        res.setHeader('expires', 'Fri, 01 Jan 1980 00:00:00 GMT')
        res.setHeader('pragma', 'no-cache')
        res.setHeader('cache-control', 'no-cache, max-age=0, must-revalidate')
      }

      // let the git handler run
      next()
    }
  })

  // handle other git requests
  app.get('/git/:repo/info/refs', require('../lib/routes/git-info-refs')(appConfig))
  app.get('/git/:repo/HEAD', require('../lib/routes/git-head')(appConfig))
  app.post('/git/:repo/:service', require('../lib/routes/git-post')(appConfig))

  // app.use('/config/save', function (req, res) {
  //   res.end(JSON.stringify({
  //     success: true
  //   }))
  // })

  // global error handling
  app.use(function onerror (err, req, res, next) {
    debug('error!')
    console.error(err)
    res.statusCode = 500
    res.end('Unexpected Error')
  })

  // static files
  // app.use(serveStatic(staticRoot, {
  //   'index': ['index.html']
  // }))

  // create node.js http server and listen on port
  app.listen(appConfig.serverPort, () => {
    debug('Server is now listening')
  })
  // http.createServer(app).listen(appConfig.serverPort)
}
