const path = require('path')
const debug = require('../debug')(__filename)
const File = require('../file')
const walk = require('../walk')

class SyncJob {
  constructor (folder) {
    this.folder = folder
    this.ref = 'refs/heads/' + folder.git.branch
    this.referenceFileObj = new File(this.ref, null, this.folder)
  }

  run () {
    return new Promise((resolve, reject) => {
      this.walk().then(() => {
        Promise.all(this.processStorageProviders()).then(
          () => resolve(),
          (err) => reject(err)
        )
      }).catch((err) => reject(err))
    })
  }

  walk () {
    const objectsDir = path.join(this.folder.gitLocation, 'objects')

    return walk(objectsDir).then(
      (files) => {
        this.files = files
        this.files[ path.join(this.folder.gitLocation, this.ref) ] = null
        return this.files
      }
    )
  }

  processStorageProviders () {
    return this.folder.storageProviders.map((provider) => {
      return this.processStorageProvider(provider)
    })
  }

  processStorageProvider (provider) {
    return new Promise((resolve, reject) => {
      provider.fetch(this.referenceFileObj, this.folder).then(
        (data) => {
          console.log('downloaded ref')
          // determine what needs to be uploaded baed on ref contents
        },
        (err) => {
          if (err.code === 'NoSuchKey') {
            debug('ref does not exist')
            // ref file is missing, we need to upload everything!
            this.uploadFiles(provider, this.files).then(
              () => resolve(),
              (err) => reject(err)
            )
          } else {
            console.log(err)
            reject(err)
          }
        }
      )
    })
  }

  uploadFiles (provider, files) {
    return new Promise((resolve, reject) => {
      const keys = Object.keys(files)

      let one = function () {
        if (keys.length === 0) {
          return resolve()
        }

        let filePath = keys.shift()
        this.uploadFile(provider, filePath).then(
          () => one(),
          (err) => reject(err)
        )
      }.bind(this)

      one()
    })
  }

  uploadFile (provider, filePath) {
    let stats = this.files[filePath]
    let file = new File(filePath, stats, this.folder)
    return provider.syncFile(file, this.folder)
  }
}

function removeFile (path, stats) {
  let file
  if (this.cache[path] == null) {
    file = new File(path, stats, this)
    this.cache[path] = file
  } else {
    file = this.cache[path]
    file.stats = stats
  }

  this.storageProviders.forEach((provider) => {
    provider.removeFile(file, this).catch((err) => {
      console.log('failed to remove file', err)
    })
  })
}

module.exports = function (job) {
  return new Promise((resolve, reject) => {
    const folderId = job.params.folderId
    const folder = global.appConfig.getFolderById(folderId)

    if (folder == null) {
      return reject(new Error('folder not found: ' + folderId))
    }

    new SyncJob(folder).run().then(resolve, reject)
  })
}
