const path = require('path')
const debug = require('./debug')(__filename)
const BaseClass = require('./base-class')

class StorageProvider extends BaseClass {
  static get defaults () {
    return {}
  }

  static get requiredOptions () {
    return []
  }

  constructor (values) {
    super(values)
    this.debug = require('./debug')(__filename, this.name)
  }

  get name () {
    return this.get('name') || this.get('id')
  }

  /**
   * Perform a series of simple health checks to verify this
   * storage provider will operate correctly.
   */
  healthCheck () {
    return new Promise((resolve, reject) => {
      const hasRequiredOpts = this.constructor.requiredOptions.every((requiredOption) => {
        return this.option(requiredOption)
      })

      if (hasRequiredOpts) {
        resolve()
      } else {
        reject()
      }
    })
  }

  supportsDiffs () {
    return false
  }

  /**
   * Get / fetch / download an object from storage provider,
   * then automatically decrypt it if it's encrypted
   */
  getObject (object) {
    return new Promise((resolve, reject) => {
      debug('getObject: %s objectKey: %s', object.location, object.objectKey)

      Promise.resolve()
        .then(() => this.download(object))
        .then(() => object.decrypt())
        .then(() => resolve())
        .catch((err) => reject(err))
    })
  }

  putObject (object) {
    return new Promise((resolve, reject) => {
      debug('putObject: %s objectKey: %s', object.location, object.objectKey)

      Promise.resolve()
        .then(() => object.stat())
        .then(() => object.encrypt())
        .then(() => this.upload(object))
        .then(() => object.cleanup())
        .then(() => resolve())
        .catch((err) => {
          // if anything fails, still attempt to cleanup
          object.cleanup().then(() => reject(err))
        })
    })
  }

  deleteObject (object) {
    //
  }

  static fromObject (obj) {
    const Provider = require(path.join('../providers/' + obj.provider))
    const provider = new Provider(obj)

    provider.healthCheck().then(
      () => provider.init(),
      (err) => {
        console.error(err)
        throw new Error('Storage Provider Health Check Failure')
      }
    )

    return provider
  }
}

module.exports = StorageProvider
