const debug = require('../lib/debug')(__filename)
const StorageProvider = require('../lib/storage-provider')
const AWS = require('aws-sdk')

class BackendS3 extends StorageProvider {
  static get defaultOptions () {
    return {
      storageClass: 'STANDARD', // REDUCED_REDUNDANCY | STANDARD_IA
      region: 'us-east-1'
    }
  }

  static get requiredOptions () {
    return ['key', 'secret', 'bucket']
  }

  init () {
    this.s3 = new AWS.S3({
      apiVersion: 'latest',
      accessKeyId: this.option('key'),
      secretAccessKey: this.option('secret'),
      region: this.option('region'),
      sslEnabled: true,
      computeChecksums: true
    })
  }

  download (object) {
    return new Promise((resolve, reject) => {
      const params = {
        Bucket: this.option('bucket'),
        Key: object.key
        // IfModifiedSince: new Date(),
      }

      this.s3.getObject(params, (err, data) => {
        if (err) {
          return reject(err)
        }

        const writeStream = object.tempWriteStream()
        writeStream.write(data.Body)
        writeStream.end()
        writeStream.on('finish', () => {
          console.log(data)
          resolve(data)
        })
      })
    })
  }

  upload (object) {
    return new Promise((resolve, reject) => {
      object.checksum('md5', 'base64').then((md5sum) => {
        const objectKey = object.key
        debug('key: %s, md5sum: %s', objectKey, md5sum)
        const params = {
          ACL: 'private',
          Body: object.stream,
          Bucket: this.option('bucket'),
          ContentEncoding: object.encoding,
          ContentLength: object.size,
          ContentMD5: md5sum,
          ContentType: object.type,
          Key: objectKey,
          ServerSideEncryption: this.ifOption('encrypt') ? 'AES256' : null,
          StorageClass: this.option('storageClass').toUpperCase(),

          Metadata: {}
          // ContentDisposition: 'STRING_VALUE',
          // Tagging: 'STRING_VALUE',
        }

        // likely should consider moving to s3.upload for concurrency
        // or to using MultiPartUploads so we can handle block-based uploads
        this.s3.putObject(params, (err, data) => {
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
  }

  removeFile (object) {
    return new Promise((resolve, reject) => {
      const params = {
        Bucket: this.config.bucket,
        Key: object.key
        // VersionId: 'STRING_VALUE'
      }

      this.s3.deleteObject(params, (err, data) => {
        if (err) {
          reject(err)
        } else {
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
