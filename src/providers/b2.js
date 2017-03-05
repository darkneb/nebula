const debug = require('../lib/debug')(__filename)
const path = require('path')
const StorageProvider = require('../lib/storage-provider')
const B2 = require('backblaze-b2')

class BackendB2 extends StorageProvider {
  init () {
    this.config.encrypt = this.config.encrypt !== false

    this.b2 = new B2({
      accountId: this.config.aid,
      applicationKey: this.config.key
    })
  }

  locations () {
    // return new Promise((resolve, reject) => {
    //   this.b2.listBuckets().then(
    //     () => {
    //       resolve
    //     }
    //   )
    // })
  }

  fetch (file, folder) {
    return new Promise((resolve, reject) => {
      debug('fetch: %s', file.abs)
      file.getEncryptionKey().then(
        (encKey) => {
          const params = {
            bucketName: this.config.bucket,
            fileName: path.join(folder.providers[this.id].path, file.name)
            // IfModifiedSince: new Date(),
          }

          this.b2.downloadFileByName(params, (err, data) => {
            if (err) {
              debug('fetch: failed')
              return reject(err)
            }

            console.log(data)
            resolve(data)
          })
        },
        (err) => reject(err)
      )
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

module.exports = BackendB2
