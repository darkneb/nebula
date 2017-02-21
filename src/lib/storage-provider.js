const path = require('path')

class StorageProvider {
  constructor (obj, appConfig) {
    this.id = obj.id
    this.displayName = obj.name
    this.config = obj.config
    this.appConfig = appConfig
    this.debug = require('./debug')(__filename, this.name)
    this.operationInProgress = false
  }

  get name () {
    return this.displayName || this.id
  }

  supportsDiffs () {
    return false
  }

  static fromObject (obj) {
    const Provider = require(path.join('../providers/' + obj.provider))
    const provider = new Provider(obj, this)
    provider.init()
    return provider
  }
}

module.exports = StorageProvider
