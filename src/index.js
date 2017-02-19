const debug = require('./lib/debug')(__filename)

debug('initializing...')

process.on('unhandledRejection', function (reason, p) {
  console.log('Possibly Unhandled Rejection at: Promise', p, 'reason:', reason)
})

require('./start/config').then(function (config) {
  Promise.all([
    require('./start/index-folders')(config)
  ]).then(() => {
    require('./start/webserver')(config)
    require('./start/watch')(config)
  }).catch(onError)
}).catch(onError)

function onError (err) {
  console.warn('syncstuff caught an error')
  console.error(err)
  process.exit(1)
}
