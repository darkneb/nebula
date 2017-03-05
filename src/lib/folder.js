const os = require('os')
const path = require('path')
const fs = require('graceful-fs')
const BaseClass = require('./base-class')
const GitRepo = require('./git-repo')

const FolderStatus = {
  Indexing: 'INDEXING',
  NoGitRepo: 'NOGITREPO'
}

const DEFAULT_CIPHER = 'aes128'

class Folder extends BaseClass {
  static get defaults () {
    return {
      id: null,
      location: null,
      name: null,
      providers: {}
    }
  }

  static get defaultOptions () {
    return {
      /**
       * globalIgnores
       * Whether to use global ignore rules to filter out files best left unsynced
       */
      globalIgnores: true,

      /**
       * ignoreHiddenFiles
       * Optionally can ignore hidden files when syncing
       */
      ignoreHiddenFiles: false,

      /**
       * index
       * When set to true, syncstuff will look for changes to files being
       * synced on startup of the service.
       * When a folder is larger, this option can be used to skip indexing
       * on bootup. It will then only reindex when manually requested, and
       * catch future file changes while syncstuff is running.
       */
      index: true,

      /**
       * watch
       * Whether we should watch the folder for file system modifications.
       * If a folder is larger enough, this might cause poor performance.
       * In which case, disable this, and use polling
       */
      watch: true,

      /**
       * poll
       * As an alternative to file system watching, we can poll looking for
       * changes to files. This can only be used when watching is disabled.
       */
      poll: false
    }
  }

  constructor (values) {
    super(values)
    this.status = FolderStatus.Indexing
    this.git = new GitRepo(this.gitLocation, this.location)
    this.debug = require('./debug')(__filename, this.name)
  }

  // toJSON () {
  //   let json = super()
  //   // let json = {
  //   //   provider: this.providers,
  //   //   options: Object.assign({}, this.options)
  //   // }
  //   return json
  // }

  /**
   * Return array of storage providers configured with this folder
   * We do not want to cache this
   */
  get storageProviders () {
    return global.appConfig.getProvidersForFolder(this)
  }

  get name () {
    return this.get('name') || this.get('id')
  }

  get location () {
    let location = this.get('location')

    // replace ~ with user's home directory
    if (location.startsWith('~')) {
      return path.join(os.homedir(), location.substr(1))
    }

    // otherwise return the path
    return location
  }

  /**
   * Return the location the .git repo is located
   */
  get gitLocation () {
    return path.join(os.homedir(), '.config', 'syncstuff', 'repos', this.get('id'), '.git')
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

  /**
   * Whether this folder is using encryption
   */
  useEncryptionForProvider (provider) {
    return !!this.get(['providers', provider.get('id'), 'encryption'])
  }

  getCipher (provider) {
    const configKey = ['providers', provider.get('id'), 'encryption', 'cipher']
    let cipher = this.get(configKey)
    if (typeof cipher === 'string') {
      return cipher
    } else {
      this.set(configKey, DEFAULT_CIPHER)
      return DEFAULT_CIPHER
    }
  }

  getEncryptionKey (provider) {
    return new Promise((resolve, reject) => {
      let save = false
      let configKey = ['providers', provider.get('id'), 'encryption']
      let encryption = this.get(configKey) || {}

      if (!encryption.cipher) {
        encryption.cipher = DEFAULT_CIPHER
        save = true
      }

      if (!encryption.key) {
        encryption.key = this.generateKey(provider)
        save = true
      }

      // save this key now that we generated it
      if (save) {
        this.set(configKey, encryption)
      }

      resolve(encryption.key)
    })
  }

  generateKey (provider) {
    const key = require('crypto').randomBytes(64).toString('base64')
    this.debug.obfuscate('generated encryption key: %s', key)
    return key
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
    return new Folder(obj)
  }
}

module.exports = Folder
