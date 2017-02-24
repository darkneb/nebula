const debug = require('./debug')(__filename)
const path = require('path')
const fs = require('graceful-fs')
const mkdirp = require('mkdirp')
const nodegit = require('nodegit')
const Events = require('./events')
const spawn = require('child_process').spawn

class Git extends Events {
  constructor (repoLocation, folderLocation) {
    super()
    this.repoLocation = repoLocation
    this.folderLocation = folderLocation
    this.branch = 'master'
  }

  create (repo) {
    return new Promise((resolve, reject) => {
      mkdirp(this.repoLocation, (err) => {
        if (err) {
          debug('failed to create repo directory')
          return reject(err)
        }

        nodegit.Repository.init(this.repoLocation, false).then(
          (repo) => {
            console.log(repo)
            debug('new repo %s created', '')
            this.config().then(resolve, reject)
          },
          (err) => reject(err)
        )
      })
    })
  }

  config () {
    return new Promise((resolve, reject) => {
      const defaultConfig = `[core]
        repositoryformatversion = 0
        filemode = true
        bare = false
        logallrefupdates = true
        ignorecase = true
        precomposeunicode = true
        excludesfile = .syncstuff-ignore`

      fs.writeFile(path.join(this.repoLocation, 'config'), defaultConfig, (err) => {
        if (err) reject(err)
        else resolve()
      })

      const ignores = [
        '.git/',
        'node_modules/',
        '*.pyc',
        '*.swp'
      ].join('\n')

      // write the default .syncstuff-ignore file
      fs.writeFile(path.join(this.folderLocation, '.syncstuff-ignore'), ignores, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  /**
   * Stage all changes
   */
  indexAll () {
    return new Promise((resolve, reject) => {
      let args = [ '--git-dir', this.repoLocation, '-C', this.folderLocation, 'add', '--all' ]
      this.exec(args, resolve, reject)
    })
  }

  commit (message) {
    return new Promise((resolve, reject) => {
      let args = ['--git-dir', this.repoLocation, '-C', this.folderLocation, 'commit', '-m', message]
      this.exec(args, resolve, reject)
    })
  }

  exec (args, resolve, reject) {
    let cmd = spawn('git', args)
    let stdout = ''
    let stderr = ''

    cmd.on('error', function (err) {
      debug('Unable to spawn git process, git might not be installed %s', err)
      reject(err)
    })

    cmd.stdout.on('data', (data) => {
      debug('stdout: %s', data)
      stdout += data
    })

    cmd.stderr.on('data', (data) => {
      debug('stderr: %s', data)
      stderr += data
    })

    cmd.on('close', function (exitCode) {
      debug('git commit finished with status %s', exitCode)
      // git status code 128 means "errors already reported", need to looking
      // at stderr to see what that means
      if (exitCode === 128) {
        if (stderr.includes('Unable to create') && stderr.includes('index.lock')) {
          // cannot create index.lock file, likely syncstuff crashed or similar
          // set a timeout, see if an operation is in progress, and remove the file
          setTimeout(() => {
            let retry = this.cmd.bind(this, args, resolve, reject)
            this.removeLockFile().then(retry, retry)
          }, 1500)
        } else {
          // unhandled error
          reject(new Error(stderr))
        }
      } else {
        resolve(stdout)
      }
    })
  }

  removeLockFile () {
    return new Promise((resolve, reject) => {
      fs.unlink(path.join(this.repoLocation, 'index.lock'), (err) => {
        if (err) {
          debug('failed to remove index.lock')
          reject(err)
        } else {
          debug('cleaned up lingering index.lock')
          resolve()
        }
      })
    })
  }

  static get supportedServices () {
    return ['upload-pack', 'receive-pack']
  }
}

module.exports = Git
