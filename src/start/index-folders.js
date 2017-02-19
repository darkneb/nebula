const debug = require('../lib/debug')(__filename)

module.exports = function (config) {
  return new Promise((resolve, reject) => {
    debug('starting to index folders')
    let promises = []

    for (const folder of config.folders) {
      if (folder.options.index) {
        debug('skipping indexing for: %s', folder.name)
      } else {
        debug('indexing fodler: %s', folder.name)
        promises.push(folder.index())
      }
    }

    Promise.all(promises).then(resolve, reject)
  })
}
