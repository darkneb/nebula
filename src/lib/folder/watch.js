const watch = require('watch')
const ignoreRules = require('../ignore-rules')

class FolderWatch {
  constructor (folder) {
    this.folder = folder
    this.debug = require('../debug')(__filename, this.folder.name)
  }

  get watchOptions () {
    return {
      filter: (file, stat) => {
        this.filter(file, stat)
      }
    }
  }

  /**
   * Start watching for file changes
   */
  start () {
    const path = this.folder.abs
    this.debug('starting to watch: %s', path)
    watch.createMonitor(path, (monitor) => {
      this.watchMonitor = monitor
      this.watchMonitor.on('created', this.onFileCreated.bind(this))
      this.watchMonitor.on('changed', this.onFileChanged.bind(this))
      this.watchMonitor.on('removed', this.onFileRemoved.bind(this))

      // this.watchMonitor.stop()
    })
  }

  filter (file, stat) {
    this.debug('watch filter check: %s', file)
    if (this.folder.options.ignoreHiddenFiles) {
      // TODO
    }

    if (this.folder.options.globalIgnores) {
      this.debug('using global ignore rules')
      let some = ignoreRules.matches.some((m) => {
        return m.match(file)
      })

      if (some) {
        return false
      }
    }

    return true
  }

  syncFile (file, stats) {
    if (stats && stats.size === 0) {
      // skip empty files, as most services will reject it
      this.debug('ignoring empty file')
    } else if (this.filter(file, stats)) {
      this.folder.syncFile(file, stats)
    } else {
      this.debug('file ignored due to filters %s', file)
    }
  }

  onFileCreated (file, stats) {
    this.debug('onFileCreated: %s', file)
    this.syncFile(file, stats)
  }

  onFileChanged (file, curr, prev) {
    this.debug('onFileChanged: %s', file)
    this.syncFile(file)
  }

  onFileRemoved (file, stats) {
    this.debug('onFileRemoved: %s', file)
    console.log(stats)
    if (this.filter(file, stats)) {
      this.folder.removeFile(file, stats)
    } else {
      this.debug('file ignored due to filters %s', file)
    }
  }
}

module.exports = FolderWatch
