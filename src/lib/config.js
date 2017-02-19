
class ConfigObject {
  constructor (data) {
    if (data) {
      this.data = data
    }
  }

  loadFromFile (file) {
    JSON.parse()
  }

  get (key) {
    return this.data[key]
  }

  set (key, value) {
    this.data[key] = value
  }

  save () {
    // TODO
  }
}

module.exports = ConfigObject
