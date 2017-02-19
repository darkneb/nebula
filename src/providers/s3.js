const debug = require('../lib/debug')(__filename)
const path = require('path')
const StorageProvider = require('../lib/storage-provider')
const AWS = require('aws-sdk')

class BackendS3 extends StorageProvider {
  init () {
    this.config.bucket
    this.config.encrypt = this.config.encrypt !== false
    this.config.storageClass = 'standard' // REDUCED_REDUNDANCY | STANDARD_IA

    this.s3 = new AWS.S3({
      apiVersion: 'latest',
      accessKeyId: this.config.key,
      secretAccessKey: this.config.secret,
      region: this.config.region || 'us-east-1',
      sslEnabled: true,
      computeChecksums: true
      // credentials: new AWS.Credentials({
      //   accessKeyId: this.config.key,
      //   secretAccessKey: this.config.secret
      // })
    })
  }

  syncFile (file, folder) {
    debug('syncing: %s', file.abs)
    return new Promise((resolve, reject) => {
      Promise.resolve()
        .then(() => file.stat())
        .then(() => file.encrypt())
        .then(() => file.md5(file.stream, 'base64'))
        .then((md5sum) => {
          debug('md5sum: %s', md5sum)
          const params = {
            ACL: 'private',
            Body: file.stream,
            Bucket: this.config.bucket,
            ContentEncoding: file.encoding,
            ContentLength: file.tempfile.stats.size,
            ContentMD5: md5sum,
            ContentType: file.type,
            Key: path.join(folder.providers[this.id].path, file.name),
            ServerSideEncryption: this.config.encrypt ? 'AES256' : null,
            StorageClass: this.config.storageClass.toUpperCase(),

            Metadata: {}
            // ContentDisposition: 'STRING_VALUE',
            // Tagging: 'STRING_VALUE',
          }

          this.s3.putObject(params, (err, data) => {
            if (err) {
              debug('putObject returned an error')
              this.handleError(err, resolve, reject)
            } else {
              debug('putObject complete')
              resolve()
            }
          })
        })
        .catch((err) => reject(err))
    })
  }

  /**
   * handleError
   * Attempt to recover from an error given to us from Amazon S3
   */
  handleError (err, resolve, reject) {
    if (err.code === 'InvalidDigest') {
      // our md5 checksum did not match what S3 calcualted
    }

    reject(err)
  }
}

module.exports = BackendS3
