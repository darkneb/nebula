const debug = require('../lib/debug')(__filename)
const FolderIndexer = require('../lib/folder/indexer')

module.exports = function (config) {
  return new Promise((resolve, reject) => {
    debug('starting to index folders')
    let promises = []

    for (const folder of config.folders) {
      if (folder.options.index) {
        debug('indexing folder: %s', folder.name)
        promises.push(
          new FolderIndexer(folder).start()
        )
      }
    }

    Promise.all(promises).then(resolve, reject)
  })
}
