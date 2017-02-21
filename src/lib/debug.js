const path = require('path')
const debug = require('debug')

const ECHO_KEYS = process.argv.some(function (arg) {
  return arg === '--debug-keys'
})

module.exports = function (file, exta) {
  const relative = path.relative(__filename, file)
  const prefix = 'syncstuff/' + relative.replace('../../', '').replace('../', 'lib/')
  const dbg = debug(prefix + (typeof exta === 'string' ? ':' + exta : ''))

  /**
   * Utility to obfuscate params when --debug-keys is not passed to executable
   */
  dbg.obfuscate = function (msg, value) {
    return dbg(msg, ECHO_KEYS ? value : '******************************')
  }

  return dbg
}
