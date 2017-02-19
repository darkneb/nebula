const debug = require('../lib/debug')(__filename)
const path = require('path')
const StorageProvider = require('../lib/storage-provider')
const AWS = require('aws-sdk')

class BackendS3 extends StorageProvider {
  init () {
    this.config.bucket

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
      Promise.all([
        file.stat(),
        file.md5()
      ]).then(
        (stats, md5sum) => {
          debug('md5sum: %s', md5sum)
          console.log(arguments)
          const params = {
            Bucket: this.config.bucket,
            Key: path.join(folder.providers[this.id].path, file.name),
            ACL: 'private',
            Body: file.stream,
            ContentLength: stats.size,
            ContentMD5: md5sum,
            ServerSideEncryption: this.config.encrypt ? 'AES256' : null,
            StorageClass: 'STANDARD', // REDUCED_REDUNDANCY | STANDARD_IA
            Metadata: {}
            // ContentDisposition: 'STRING_VALUE',
            // ContentEncoding: 'STRING_VALUE',
            // ContentLanguage: 'STRING_VALUE',
            // ContentType: 'STRING_VALUE',
            // Expires: new Date || 'Wed Dec 31 1969 16:00:00 GMT-0800 (PST)' || 123456789,
            // Tagging: 'STRING_VALUE',
            // WebsiteRedirectLocation: 'STRING_VALUE'
          }

          this.s3.putObject(params, function (err, data) {
            if (err) {
              reject(err)
            } else {
              resolve()
            }
          })
        },
        (err) => reject(err)
      )
    })
  }
}

module.exports = BackendS3
