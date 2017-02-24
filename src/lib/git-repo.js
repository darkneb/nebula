const debug = require('./debug')(__filename)
const mkdirp = require('mkdirp')
const nodegit = require('nodegit')
const Events = require('./events')
const spawn = require('child_process').spawn

class Git extends Events {
  constructor (repoLocation) {
    super()
    this.repoLocation = repoLocation
    this.baseGitRepo = false
  }

  create (repo, cb) {
    return new Promise((resolve, reject) => {
      mkdirp(this.repoLocation, (err) => {
        if (err) {
          debug('failed to create repo directory')
          return cb(err)
        }

        nodegit.Repository.init(this.repoLocation, this.baseGitRepo).then(
          (repo) => {
            console.log(repo)
            debug('new repo %s created', '')
            cb()
          },
          (err) => cb(err)
        )
      })
    })
  }

  /**
   * Stage all changes
   */
  indexAll () {
    return new Promise((resolve, reject) => {
      let args = [ '--git-dir', this.repoLocation, '-C', this.folder.abs, 'add', '--all' ]
      let cmd = spawn('git', args)

      cmd.on('error', function (err) {
        debug('git threw an error')
        debug(err)
        reject(err)
      })

      cmd.on('close', function (exitCode) {
        debug('process ended')
        resolve()
      })

      // ps.stdout.pipe(res)
    })
  }

  commit (message) {
    return new Promise((resolve, reject) => {
      let args = [ '--git-dir', this.repoLocation, '-C', this.folder.abs, 'commit', '-m', message ]
      let cmd = spawn('git', args)

      cmd.on('error', function (err) {
        debug('git threw an error')
        debug(err)
        reject(err)
      })

      cmd.on('close', function (exitCode) {
        debug('process ended')
        resolve()
      })

      // ps.stdout.pipe(res)
    })
  }

  static get supportedServices () {
    return ['upload-pack', 'receive-pack']
  }
}

module.exports = Git
