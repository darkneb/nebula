const os = require('os')
const fs = require('fs')
const path = require('path')
const readline = require('readline')
const ignoreRules = require('./ignore-rules')
const Glob = require('glob').Glob
const File = require('./file')

class Folder {
  constructor (obj, appConfig) {
    this.id = obj.id
    this.path = obj.path
    this.name = obj.name
    this.providers = obj.providers || {}
    this.options = {}
    this.appConfig = appConfig

    /**
     * globalIgnores
     * Whether to use global ignore rules to filter out files best left unsynced
     */
    this.options.globalIgnores = obj.globalIgnores !== false

    /**
     * ignoreHiddenFiles
     * Optionally can ignore hidden files when syncing
     */
    this.options.ignoreHiddenFiles = !!obj.ignoreHiddenFiles

    /**
     * index
     * When set to true, syncstuff will look for changes to files being
     * synced on startup of the service.
     * When a folder is larger, this option can be used to skip indexing
     * on bootup. It will then only reindex when manually requested, and
     * catch future file changes while syncstuff is running.
     */
    this.options.index = obj.index !== false

    /**
     * watch
     * Whether we should watch the folder for file system modifications.
     * If a folder is larger enough, this might cause poor performance.
     * In which case, disable this, and use polling
     */
    this.options.watch = obj.watch !== false

    /**
     * poll
     * As an alternative to file system watching, we can poll looking for
     * changes to files. This can only be used when watching is disabled.
     */
    this.options.poll = this.watch ? false : !!obj.poll

    this.debug = require('./debug')(__filename, this.name)
    this.debug('folder instance created for: %s', this.name)
  }

  get abs () {
    // replace ~ with user's home directory
    if (this.path.startsWith('~')) {
      return path.join(os.homedir(), this.path.substr(1))
    }

    // otherwise return the path
    return this.path
  }

  /**
   * index
   * On starting syncstuff, this will index the folder, comparing to the last
   * known state, looking for anything that has changed to fire off sync events
   */
  index () {
    return new Promise((resolve, reject) => {
      // first we restore the existing index
      this.readIndexFile().then(
        () => {
          this.glob = new Glob('**/*', this.globOptions)
          this.glob.on('match', this.onGlobMatch.bind(this))
          this.glob.on('error', this.onGlobError.bind(this))
          this.glob.on('end', () => {
            this.debug('glob search has finished')
            resolve()
          })
        },
        (err) => reject(err)
      )
    })
  }

  get globOptions () {
    return {
      cwd: this.abs,

      // whether the glob should ignore hidden .dot files
      dot: this.ignoreHiddenFiles === false,

      // follow symblinks
      follow: true,

      // do not sort, waste of computing
      nosort: true,

      // report file system errors
      strict: true,

      // add ignore rules
      ignore: this.options.globalIgnores ? ignoreRules : []
    }
  }

  /**
   * onGlobMatch
   * Called whenever Glob finds a match to a file we want to sync
   */
  onGlobMatch (filepath) {
    //
  }

  get indexFilePath () {
    return path.join(this.abs, '.syncstuff', 'cache')
  }

  indexFile () {
    return new Promise((resolve, reject) => {
      const indexFilePath = this.indexFilePath
      this.debug('opening index file: %s', indexFilePath)
      const stream = fs.createReadStream(indexFilePath)

      stream.on('open', () => {
        resolve(stream)
      })

      stream.on('error', (err) => {
        // if file does not exist, should mean the folder is new to being synced
        if (err.code === 'ENOENT') {
          this.debug('index file does not exist')
          resolve()
        } else {
          reject(err)
        }
      })
    })
  }

  /**
   * Opens the index cache that is stored in the folder
   */
  readIndexFile () {
    return new Promise((resolve, reject) => {
      this.indexFile().then(
        (indexFileStream) => {
          if (indexFileStream == null) {
            // when stream is null, the index file does not exist
            this.index = {}
            this.debug('set index to empty')
            return resolve()
          }

          this.debug('restoring existing index')

          const rl = readline.createInterface({
            input: indexFileStream
          })

          rl.on('line', (line) => {
            this.debug('readIndexFile: readline: reading line')
            console.log('Line from file:', line)
          })

          rl.on('close', () => {
            this.debug('readIndexFile: readline: close')
            resolve()
          })
        },
        (err) => reject(err)
      )
    })
  }

  syncFile (path, stats) {
    const file = new File(path, stats, this)
    const providers = this.appConfig.getProvidersForFolder(this)
    providers.forEach((provider) => {
      provider.syncFile(file, this).catch((err) => {
        console.log(err)
      })
    })
  }

  static fromObject (obj) {
    return new Folder(obj, this)
  }
}

module.exports = Folder
