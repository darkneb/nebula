const Minimatch = require('minimatch').Minimatch

const rules = [
  // ignore .swp files
  '**/**.swp'
]

rules.matches = rules.map(function (pattern) {
  return new Minimatch(pattern, {
    dot: true
  })
})

module.exports = rules
