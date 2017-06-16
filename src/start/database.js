// we actually store all data inside a LevelDB
const levelup = require('levelup')
const leveldown = require('leveldown')

// we use Gun for inserting, updating, and managing the data in LevelDB
const Gun = require('gun')
require('gun-level')

module.exports = function (httpServer) {
  const level = levelup('data', {
    db: leveldown
  })

  let gun = Gun({
    db: level,
    file: false,
    web: httpServer
  })

  gun.opt({
    peers: ['http://localhost:8080/gun']
  })

  let alice = gun.get('person/alice').put({name: 'alice', age: 22})
  let bob = gun.get('person/bob').put({name: 'bob', age: 24})
  let carl = gun.get('person/carl').put({name: 'carl', age: 16})
  let dave = gun.get('person/dave').put({name: 'dave', age: 42})
  let ben = gun.get('person/ben').put({
    name: 'Benjamin',
    ave: 25,
    n: {
      f: 'Benjamin',
      l: 'Hutchins'
    }
  })

  let company = gun.get('startup/hype').put({
    name: 'hype',
    profitable: false,
    address: {
      street: '123 Hipster Lane',
      city: 'San Francisco',
      state: 'CA',
      country: 'USA'
    }
  })

  let employees = company.path('employees')
  employees.set(dave)
  employees.set(alice)
  employees.set(bob)

  alice.path('spouse').put(bob)
  bob.path('spouse').put(alice)

  alice.path('spouse').path('employer').put(company)
  alice.path('employer').put(company)

  dave.path('kids').set(carl)
  carl.path('dad').put(dave)

  carl.path('friends').set(alice)
  carl.path('friends').set(bob)

  ben.on(function (node) {
    console.log('subscribed to Ben!', node, node.n)
  })

  ben.val(function (node) {
    console.log('Ben via ben.val!', node)
  })

  gun.get('person/ben').val(function (node) {
    console.log('Ben!', node)
  })

  ben.path('n.f').val(function (value, key) {
    console.log('First name?', value, key)
  })

  var people = gun.get('people')

  people.set(alice)
  people.set(bob)
  people.set(carl)
  people.set(dave)

  people.map().val(function (person) {
    console.log('This person is', person)
  })

  gun.get('person/alice').path('spouse.employer.employees').map().path('name').val(function (data, key) {
    console.log("The employee's", key, data)
  })
}
