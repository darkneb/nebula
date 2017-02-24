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
    })
  }

  fetch (file, folder) {
    return new Promise((resolve, reject) => {
      debug('fetch: %s', file.abs)
      Promise.resolve()
        .then(() => file.getEncryptionKey())
        .then((encKey) => {
          const params = {
            Bucket: this.config.bucket,
            Key: path.join(folder.providers[this.id].path, file.name)
            // IfModifiedSince: new Date(),
          }

          this.s3.getObject(params, (err, data) => {
            if (err) {
              debug('fetch: failed')
              return reject(err)
            }

            console.log(data)
            resolve(data)
          })
        })
        .catch((err) => reject(err))
    })
  }

  syncFile (file, folder) {
    return new Promise((resolve, reject) => {
      debug('syncing: %s', file.abs)
      Promise.resolve()
        .then(() => file.stat())
        .then(() => file.getEncryptionKey())
        .then((encKey) => file.encrypt(encKey))
        .then(() => file.md5(file.stream, 'base64'))
        .then((md5sum) => {
          const key = path.join(folder.providers[this.id].path, file.relative)
          debug('key: %s, md5sum: %s', key, md5sum)
          const params = {
            ACL: 'private',
            Body: file.stream,
            Bucket: this.config.bucket,
            ContentEncoding: file.encoding,
            ContentLength: file.tempfile ? file.tempfile.stats.size : file.stats.size,
            ContentMD5: md5sum,
            ContentType: file.type,
            Key: key,
            ServerSideEncryption: this.config.encrypt ? 'AES256' : null,
            StorageClass: this.config.storageClass.toUpperCase(),

            Metadata: {}
            // ContentDisposition: 'STRING_VALUE',
            // Tagging: 'STRING_VALUE',
          }

          // likely should consider moving to s3.upload for concurrency
          // or to using MultiPartUploads so we can handle block-based uploads
          this.s3.putObject(params, (err, data) => {
            file.cleanupTempfile().then(() => {
              if (err) {
                debug('putObject returned an error')
                this.handleError(err, resolve, reject)
              } else {
                debug('putObject complete, etag: %s', data.ETag)
                if (data.VersionId) {
                  debug('s3 version-id: %s', data.VersionId)
                }
                resolve()
              }
            })
          })
        })
        .catch((err) => reject(err))
    })
  }

  removeFile (file, folder) {
    return new Promise((resolve, reject) => {
      debug('removing: %s', file.abs)
      const params = {
        Bucket: this.config.bucket,
        Key: path.join(folder.providers[this.id].path, file.name)
        // VersionId: 'STRING_VALUE'
      }

      this.s3.deleteObject(params, (err, data) => {
        if (err) {
          debug('deleteObject returned an error')
          // TODO: handle common delete errors
          reject(err)
        } else {
          debug('deleteObject complete')
          if (data.VersionId) {
            debug('s3 version-id: %s', data.VersionId)
          }
          resolve()
        }
      })
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
