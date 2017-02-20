const debug = require('../lib/debug')(__filename)
const _ = require('lodash')
const os = require('os')
const path = require('path')
const jsonfile = require('jsonfile')
const Folder = require('../lib/folder')
const StorageProvider = require('../lib/storage-provider')

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
    _.defaults(this.json, AppConfig.defaults)

    if (this.json.version !== 1) {
      throw new Error('Unsupported app config version.\nSupport versions: 1')
    }
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

  get folders () {
    return this.json.folders.map(Folder.fromObject, this)
  }

  get providers () {
    return this.json.providers.map(StorageProvider.fromObject, this)
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
}

module.exports = new Promise((resolve, reject) => {
  const configFilePath = path.join(os.homedir(), '.config/syncstuff/config.json')
  debug('loading config file from %s', configFilePath)

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
