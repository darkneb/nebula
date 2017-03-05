const fs = require('graceful-fs')
// const path = require('path')

function writeFile (file, data) {
  return new Promise((resolve, reject) => {
    const secondary = file + '.bak'

    fs.writeFile(secondary, data, (err) => {
      if (err) {
        return reject(err)
      }

      // fs.unlink(file, ())

      fs.rename(secondary, file, (err) => {
        if (err) {
          return reject(err)
        }

        resolve()
      })
    })
  })
}

module.exports = {
  writeFile: writeFile
}
