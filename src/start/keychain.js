const debug = require('../lib/debug')(__filename)
const crypto = require('crypto')
const keychain = require('keychain')

module.exports = new Promise((resolve, reject) => {
  const service = 'Syncstuff'
  const params = {
    account: 'master',
    service: service
  }

  keychain.getPassword(params, (err, pass) => {
    debug('received response from keychain')

    if (err && err.message === 'Could not find password') {
      // no password exists, we can generate one, or ask for one
      crypto.randomBytes(48, function (err, buffer) {
        // if we have an error here, likely means we cannot aquire a rand method
        if (err) return reject(err)

        // save the generated password to keychain
        pass = buffer.toString('hex')
        params.password = pass
        debug.obfuscate('generated master password: %s', params.password)
        keychain.setPassword(params, function (err) {
          if (err) return reject(err)
          resolve(pass)
        })
      })
    } else if (err) {
      return reject(err)
    } else {
      debug.obfuscate('restored master password: %s', pass)
      resolve(pass)
    }
  })
})
