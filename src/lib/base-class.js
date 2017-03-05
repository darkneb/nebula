const _ = require('lodash')
const uuid = require('uuid/v4')
const Events = require('./events')

class BaseClass extends Events {
  static get defaults () {
    return {}
  }

  static get defaultOptions () {
    return {}
  }

  constructor (values) {
    super()
    this.values = _.defaults(values || {}, this.constructor.defaults)

    if (_.isUndefined(this.values.options)) {
      this.values.options = {}
    }

    _.defaults(this.values.options, this.constructor.defaultOptions)

    if (!this.get('id')) {
      this.set('id', uuid())
    }
  }

  has (path) {
    return _.has(this.values, path)
  }

  get (path) {
    return _.get(this.values, path)
  }

  set (path, value) {
    _.set(this.values, path, value)
    this.emit('value changed', path, value)
    return this
  }

  unset (path) {
    return _.unset(this.values, path)
  }

  option (path, value) {
    if (typeof path === 'string') {
      path = 'options.' + path
    } else if (_.isArray(path)) {
      path.unshift('options')
    }

    if (_.isUndefined(value)) {
      return this.get(path)
    } else if (_.isNull(value)) {
      return this.unset(path)
    } else {
      return this.set(path, value)
    }
  }

  ifOption (path) {
    return this.option(path) === true
  }

  toJSON () {
    return _.cloneDeep(this.values)
  }
}

module.exports = BaseClass
