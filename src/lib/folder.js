const os = require('os')
const path = require('path')
const fs = require('graceful-fs')
const uuid = require('uuid/v4')
const Events = require('./events')
const GitRepo = require('./git-repo')

const FolderStatus = {
  Indexing: 'INDEXING',
  NoGitRepo: 'NOGITREPO'
}

class Folder extends Events {
  static get defaults () {
    return {
      id: null,
      path: '',
      name: '',
      providers: {},
      encryption: {
        cipher: 'aes128',
        key: 'secret'
      },
      options: {
        globalIgnores: true,
        ignoreHiddenFiles: false,
        index: true,
        watch: true,
        poll: false
      }
    }
  }

  constructor (obj = Folder.defaults, appConfig) {
    super()
    this.id = obj.id || uuid()
    this.path = obj.path
    this.name = obj.name
    this.providers = obj.providers || {}
    this.options = {}
    this.appConfig = appConfig
    this.cache = {}
    this.status = FolderStatus.Indexing
    this.git = new GitRepo(this.gitLocation, this.location)

    this.options.encrypt = obj.encryption || false

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

  /**
   * Return array of storage providers configured with this folder
   * We do not want to cache this
   */
  get storageProviders () {
    return this.appConfig.getProvidersForFolder(this)
  }

  get location () {
    // replace ~ with user's home directory
    if (this.path.startsWith('~')) {
      return path.join(os.homedir(), this.path.substr(1))
    }

    // otherwise return the path
    return this.path
  }

  /**
   * Return the location the .git repo is located
   */
  get gitLocation () {
    return path.join(os.homedir(), '.config', 'syncstuff', 'repos', this.id, '.git')
  }

  /**
   * Resolves an fs.Stats object
   * @see https://nodejs.org/api/fs.html#fs_class_fs_stats
   *
   * @param {boolean} force Force a stat, even if stats are cached
   */
  stat (force) {
    return new Promise((resolve, reject) => {
      if (this.stats && force !== true) {
        this.debug('using known file stats')
        return resolve(this.stats)
      }

      fs.stat(this.location, (err, stats) => {
        if (err) return reject(err)
        if (!stats.isDirectory()) {
          this.debug('Not a directory')
          return reject(new Error('Not a directory'))
        }
        this.debug('stat finished')
        this.stats = stats
        resolve(stats)
      })
    })
  }

  get useEncryption () {
    return !!this.options.encrypt
  }

  getEncryptionKey () {
    return new Promise((resolve, reject) => {
      let secret

      // secret is stored in config, encrypted with master key
      if (this.options.encryption.secret) {
        secret = this.options.encryption.secret
      } else {
        this.options.encryption.secret = this.generateKey()

        // save this key now that we generated it
        global.appConfig.save()
      }

      resolve(secret)
    })
  }

  generateKey () {
    this.debug('generating encryption key')
    return 'hello world'
  }

  setStatus (status) {
    this.status = status
    this.emit('status', this)
  }

  healthCheck () {
    return new Promise((resolve, reject) => {
      // verify the folder exists
      this.stat().then(
        (stats) => {
          // verify the .git repo exists
          fs.stat(this.gitLocation, (err, stats) => {
            if (err) {
              this.setStatus(FolderStatus.NoGitRepo)
              return reject(err)
            }

            resolve()
          })
        },
        (err) => {
          this.setStatus(FolderStatus.Paused)
          return reject(err)
        }
      )
    })
  }

  static fromObject (obj) {
    return new Folder(obj, this)
  }
}

module.exports = Folder
