const debug = require('../lib/debug')(__filename)
const _ = require('lodash')
const os = require('os')
const path = require('path')
const jsonfile = require('jsonfile')
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

  constructor (json = AppConfig.defaults) {
    this.json = json || {}
    _.defaultsDeep(this.json, AppConfig.defaults)

    if (this.json.version !== 1) {
      throw new Error('Unsupported app config version.\nSupport versions: 1')
    }

    this.folders = this.json.folders.map(Folder.fromObject, this)
    this.providers = this.json.providers.map(StorageProvider.fromObject, this)
    this.queue = new Queue()
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
    return Object.keys(folder.providers).map((providerId) => {
      return this.getProviderById(providerId)
    })
  }

  getFolderById (id) {
    for (const folder of this.folders) {
      if (folder.id === id) {
        return folder
      }
    }
  }

  getProviderById (id) {
    for (const provider of this.providers) {
      if (provider.id === id) {
        return provider
      }
    }
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
    const configFilePath = path.join(os.homedir(), '.config/syncstuff/config.json')
    debug('loading config from: %s', configFilePath)

    jsonfile.readFile(configFilePath, function (err, obj) {
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

      resolve(new AppConfig(config || AppConfig.defaults))
    })
  })
}
