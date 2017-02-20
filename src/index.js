const debug = require('./lib/debug')(__filename)
const opener = require('opener')

debug('initializing...')

process.on('unhandledRejection', function (reason, p) {
  console.log('Possibly Unhandled Rejection at: Promise', p, 'reason:', reason)
})

require('./start/config').then(function (appConfig) {
  Promise.all([
    require('./start/index-folders')(appConfig)
  ]).then(() => {
    require('./start/webserver')(appConfig)
    require('./start/watch')(appConfig)

    // auto open web browser if we should
    if (appConfig.serverAutoOpen) {
      opener('http://' + appConfig.serverHost + ':' + appConfig.serverPort)
    }
  }).catch(onError)
}).catch(onError)

function onError (err) {
  console.warn('syncstuff caught an error')
  console.error(err)
  process.exit(1)
}
