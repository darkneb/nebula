const debug = require('../lib/debug')(__filename)
const _ = require('lodash')
const os = require('os')
const path = require('path')
const jsonfile = require('jsonfile')
const cfs = require('../lib/cfs')
const Folder = require('../lib/folder')
const StorageProvider = require('../lib/storage-provider')
const Queue = require('../lib/queue')

let masterKey

class AppConfig {
  static get defaults () {
    return {
      version: 1,
      webserver: {
        port: 55555,
        host: '127.0.0.1',
        autoOpen: true
      },
      folders: [],
      providers: []
    }
  }

  constructor (json = AppConfig.defaults, configFileLocation) {
    this.location = configFileLocation
    this.json = json || {}
    _.defaultsDeep(this.json, AppConfig.defaults)

    if (this.json.version !== 1) {
      throw new Error('Unsupported app config version.\nSupport versions: 1')
    }

    this.folders = this.json.folders.map(Folder.fromObject, this)
    this.providers = this.json.providers.map(StorageProvider.fromObject, this)
    this.queue = new Queue()

    // listen for values changing, and automatically save the config file
    for (const folder of this.folders) {
      folder.on('value changed', this.save.bind(this))
    }
    for (const provider of this.providers) {
      provider.on('value changed', this.save.bind(this))
    }
  }

  hashUsingMasterKey () {
    return masterKey
  }

  hasArgument (argument) {
    return process.argv.some(function (arg) {
      return arg.startsWith('--') && arg === '--' + argument
    })
  }

  getProvidersForFolder (folder) {
    return Object.keys(folder.get('providers')).map((providerId) => {
      return this.getProviderById(providerId)
    })
  }

  getFolderById (id) {
    for (const folder of this.folders) {
      if (folder.get('id') === id) {
        return folder
      }
    }
  }

  getProviderById (id) {
    for (const provider of this.providers) {
      if (provider.get('id') === id) {
        return provider
      }
    }
  }

  save () {
    return new Promise((resolve, reject) => {
      debug('saving configuration file')

      // create the JSON object we'll be saving
      const json = {
        version: 1,
        webserver: Object.assign({}, this.json.webserver),
        folders: this.folders.map((folder) => folder.toJSON()),
        providers: this.providers.map((provider) => provider.toJSON())
      }

      // convert to string
      const data = JSON.stringify(json, null, 2)

      // save the config, first to a secondary file,
      // then we will replace the original. This way
      // we never risk losing encryption keys
      cfs.writeFile(this.location, data).then(resolve, reject)
    })
  }

  get serverHost () {
    return this.json.webserver.host
  }

  get serverPort () {
    return this.json.webserver.port
  }

  get serverAutoOpen () {
    return this.json.webserver.autoOpen
  }

  get serverUri () {
    return `http://${this.serverHost}:${this.serverPort}`
  }
}

module.exports = function (mKey) {
  masterKey = mKey

  return new Promise((resolve, reject) => {
    const configFileLocation = path.join(os.homedir(), '.config/syncstuff/config.json')
    debug('loading config from: %s', configFileLocation)

    jsonfile.readFile(configFileLocation, function (err, obj) {
      let config = null

      if (err) {
        if (err.code === 'ENOENT') {
          debug('missing config.json, will attempt to create one automatically')
        } else {
          console.warn('could not read config file at ~/.transmission-sync/config.json')
          reject(err)
        }
      } else {
        config = obj
      }

      resolve(new AppConfig(config || AppConfig.defaults, configFileLocation))
    })
  })
}
