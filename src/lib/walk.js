const path = require('path')
const fs = require('graceful-fs')

module.exports = function walk (dir) {
  return new Promise((resolve, reject) => {
    fs.readdir(dir, function (err, files) {
      if (err) return reject(err)
      let result = {}
      let promises = []

      files.forEach(function (file) {
        let abs = path.join(dir, file)
        let promise = new Promise((resolve, reject) => {
          fs.stat(abs, function (err, stats) {
            if (err) return reject(err)

            if (stats.isDirectory()) {
              walk(abs).then(
                (res) => {
                  Object.assign(result, res)
                  resolve()
                },
                (err) => reject(err)
              )
            } else {
              result[abs] = stats
              resolve()
            }
          })
        })

        promises.push(promise)
      })

      Promise.all(promises).then(
        () => resolve(result),
        (err) => reject(err)
      )
    })
  })
}
