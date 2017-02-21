const levelup = require('levelup')

class Database {
  constructor (folder) {
    this.folder = folder
    this.debug = require('../debug')(__filename, this.path)

    this.leveldb = levelup(this.folder.databaseLocation, {
      createIfMissing: true
    })

    this.leveldb.on('error', (error) => {
      if (error.type === 'OpenError' && String(error).includes('already held by process')) {
        this._handleLockFile()
      } else {
        this.debug('leveldb error!')
        console.log(error.type, error.code)
      }
    })
  }

  isOpen () {
    return this.leveldb.isOpen()
  }

  close () {
    return new Promise((resolve, reject) => {
      this.debug('database closing')
      this.leveldb.on('error', (err) => {
        this.debug('failed to close database')
        reject(err)
      })
      this.leveldb.on('closing', () => {
        this.debug('for real now')
      })
      this.leveldb.on('closed', () => {
        this.debug('database closed')
        resolve()
      })
      this.leveldb.close()
    })
  }

  /**
   * Attempt to repair the leveldb
   * If this fails, it exits the process.
   */
  repairDatabase () {
    return new Promise((resolve, reject) => {
      this.debug('database repair: starting')

      require('leveldown').repair(this.folder.databaseLocation, (err) => {
        if (err) {
          this.debug('database repair: failed')
          return reject(err)
        }

        this.debug('database repair: complete')
        resolve()
      })
    })
  }

  on (event, func) {
    return this.leveldb.on(event, func)
  }

  put (key, value) {
    return new Promise((resolve, reject) => {
      this.leveldb.put(key, value, (err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  get (key) {
    return new Promise((resolve, reject) => {
      this.leveldb.get(key, (err, value) => {
        if (err) return reject(err)
        resolve(value)
      })
    })
  }

  del (key) {
    return new Promise((resolve, reject) => {
      this.leveldb.del(key, (err, value) => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  batch () {
    //
  }

  /**
   * _handleLockFile
   * Called when a database `LOCK` file is discovered inside the database
   * directory on startup.
   *
   * @private
   */
  _handleLockFile () {
    if (this.folder.appConfig.hasArgument('repair-dbs')) {
      this.repairDatabase().then(
        () => {},
        (err) => {
          // failed to repair the databse, need to exit and let the user fix it
          console.error(err)
          process.exit('db-repair-failed')
        }
      )
    } else {
      process.exit('db-lock-lingering')
    }
  }
}

module.exports = Database
