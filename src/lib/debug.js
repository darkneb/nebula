const path = require('path')
const debug = require('debug')

module.exports = function (file, exta) {
  const relative = path.relative(__filename, file)
  const prefix = 'syncstuff/' + relative.replace('../../', '').replace('../', 'lib/')
  return debug(prefix + (typeof exta === 'string' ? ':' + exta : ''))
}
