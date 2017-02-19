const levelup = require('levelup')

class Database {
  constructor (path) {
    this.leveldb = levelup(path)
  }

  close () {
    this.leveldb.close()
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
}

module.exports = Database
