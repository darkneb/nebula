const debug = require('./lib/debug')(__filename)
const path = require('path')
const fs = require('graceful-fs')
const opener = require('opener')

const startConfig = require('./start/config')
const startDatabase = require('./start/database')
// const startIndexFolders = require('./start/index-folders')
const startWebServer = require('./start/webserver')
// const startWatch = require('./start/watch')
const FolderWatch = require('./lib/folder/watch')

function main () {
  debug('initializing...')

  // let nodejs know we want to catch exit requests
  process.stdin.resume()

  // we use a lot of promises, in case we miss handling one, report it here
  process.on('unhandledRejection', function (reason, p) {
    console.log('Possibly Unhandled Rejection at: Promise', p, 'reason:', reason)
  })

  // grab your master keys from your system keychain, if we can
  require('./start/keychain').then((masterKey) => {
    // load your app config, decrypting with your master key
    startConfig(masterKey).then(function (appConfig) {
      // throw a few things into the global process namespace
      global.appConfig = appConfig
      global.queue = appConfig.queue

      // catch process exiting, cleanup the database locks
      process.on('exit', onExit)
      // catch these events that kill the process without triggering the 'exit' event
      process.on('SIGINT', triggerExit)
      process.on('uncaughtException', triggerExit)

      // startup web server
      let httpServer = startWebServer(appConfig)
      startDatabase(httpServer)

      // start health checking folders
      for (const folder of appConfig.folders) {
        folder.healthCheck().then(
          () => {
            debug('health checks passed for folder: %s', folder.name)
            // index folder
            // if (folder.options.index) {
            //   new FolderIndexer(folder).start()
            // }

            // start watching folder
            if (folder.ifOption('watch')) {
              debug('starting watch of folder: %s', folder.name)
              folder.watch = new FolderWatch(folder).start()
            }
          },
          (err) => {
            debug('Health checks failed for folder: %', folder.name)
            console.error(err)
          }
        )
      }

      // auto open web browser if we should
      if (appConfig.serverAutoOpen) {
        opener(appConfig.serverUri)
      }
    }).catch(onError)
  }).catch(onError)
}

function onExit (appConfig, exitStatus) {
  debug('process.onExit triggered with exit code: %s', exitStatus)

  // if this is a custom exit status, show a help message
  if (typeof exitStatus === 'string') {
    try {
      let exitMessage = String(fs.readFileSync(path.join(__dirname, `exits/${exitStatus}.md`)))
      let lines = exitMessage.split('\n')
      exitStatus = parseInt(lines.shift().replace('CODE:', ''), 10)
      fs.writeSync(1, lines.join('\n'))
    } catch (ex) {
      console.error(ex)
    }
  }

  cleanupAndExit(appConfig, exitStatus)
}

function triggerExit (err) {
  debug('about to trigger exit event')
  if (err) { // this would be an uncaughtException
    console.error(err, err.stack || (new Error()).stack)
  }
  cleanupAndExit(err ? 1 : 0)
}

function cleanupAndExit (exitStatus) {
  const promises = []
  for (const folder of global.appConfig.folders) {
    if (folder.db && folder.db.isOpen()) {
      debug('attempting to close database for %s', folder.name)
      promises.push(folder.db.close())
    }
  }
  Promise.all(promises).then(() => {
    debug('promises have finished')
    process.exit(exitStatus || 0)
  })
}

function onError (err) {
  console.warn('syncstuff caught an error')
  console.error(err)
  process.exit(1)
}

module.exports = {
  cli: main
}
