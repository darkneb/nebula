const _ = require('lodash')
const path = require('path')
const watch = require('watch')
const ignoreRules = require('../ignore-rules')

class FolderWatch {
  constructor (folder) {
    this.folder = folder
    this.debug = require('../debug')(__filename, this.folder.name)

    this.commitMessage = []

    // queue up changes, as to not create too many commit messages
    this.commitAllChanges = _.debounce(
      () => {
        let job = global.queue.create('commit', {
          folderId: this.folder.id,
          messageLines: this.commitMessage
        })

        this.commitMessage = []

        job.save()
      },
      5000
    )
  }

  get watchOptions () {
    return {
      filter: (file, stat) => {
        const filter = this.filter(file, stat)
        // this.debug('watch filtering %s, returned %s', file, filter ? 'true' : 'false')
        return filter
      }
    }
  }

  /**
   * Start watching for file changes
   * On a file change, we commit the changes to git repo
   */
  start () {
    const path = this.folder.abs
    this.debug('starting to watch: %s', path)

    if (this.folder.options.globalIgnores) {
      this.debug('**globalIgnores are on for %s**', this.folder.name)
    }

    watch.createMonitor(path, this.watchOptions, (monitor) => {
      this.watchMonitor = monitor
      this.watchMonitor.on('created', this.onFileCreated.bind(this))
      this.watchMonitor.on('changed', this.onFileChanged.bind(this))
      this.watchMonitor.on('removed', this.onFileRemoved.bind(this))

      // this.watchMonitor.stop()
    })
  }

  filter (file, stat) {
    if (this.folder.options.ignoreHiddenFiles) {
      if (path.basename(file).substr(0, 1) === '.') {
        return false
      }
    }

    if (this.folder.options.globalIgnores) {
      let some = ignoreRules.matches.some((m) => {
        return m.match(file)
      })

      if (some) {
        this.debug('filter rules deny: %s', file)
        return false
      }
    }

    return true
  }

  syncFile (file, stats, message) {
    if (stats && stats.size === 0) {
      // skip empty files, as most services will reject it
      this.debug('ignoring empty files from creates')
    } else if (this.filter(file, stats)) {
      this.debug(message)
      this.commitMessage.push(message)
      this.commitAllChanges()
    }
  }

  onFileCreated (file, stats) {
    this.syncFile(file, stats, 'File created: ' + file)
  }

  onFileChanged (file, curr, prev) {
    this.syncFile(file, null, 'File changed: ' + file)
  }

  onFileRemoved (file, stats) {
    if (this.filter(file, stats)) {
      this.debug('onFileRemoved: %s', file)

      this.commitMessage.push('File removed: ' + file)
      this.commitAllChanges()
    } else {
      this.debug('file ignored due to filters %s', file)
    }
  }
}

module.exports = FolderWatch
