const debug = require('../lib/debug')(__filename)
const FolderWatch = require('../lib/folder/watch')

module.exports = function (appConfig) {
  debug('starting to watch folders')

  for (const folder of appConfig.folders) {
    if (folder.options.watch) {
      debug('starting watch of folder: %s', folder.name)
      const folderWatch = new FolderWatch(folder).start()
      folder.watch = folderWatch
    }
  }
}
