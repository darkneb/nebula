const util = require('util')
const EventEmitter = require('events').EventEmitter

class Events {
  constructor () {
    EventEmitter.call(this)
  }
}

util.inherits(Events, EventEmitter)

module.exports = Events
