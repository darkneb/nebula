const debug = require('../debug')(__filename)
const fs = require('graceful-fs')
const path = require('path')

module.exports = function (appConfig) {
  return function (req, res) {
    debug('/HEAD request')
    const file = path.join(req.folder.gitLocation, 'HEAD')

    res.disableCache()

    fs.createReadStream(file).pipe(res)
    // TODO: Handle when this file does not exist
  }
}
