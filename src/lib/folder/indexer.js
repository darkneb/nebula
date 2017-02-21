const fs = require('graceful-fs')
const path = require('path')
const readline = require('readline')
const ignoreRules = require('../ignore-rules')
const Glob = require('glob').Glob

class FolderIndexer {
  constructor (folder) {
    this.folder = folder
    this.debug = require('../debug')(__filename, this.folder.name)
  }

  /**
   * index
   * On starting syncstuff, this will index the folder, comparing to the last
   * known state, looking for anything that has changed to fire off sync events
   */
  start () {
    return new Promise((resolve, reject) => {
      // first we restore the existing index
      this.readIndexFile().then(
        () => {
          this.glob = new Glob('**/*', this.globOptions)
          this.glob.on('match', this.onGlobMatch.bind(this))
          this.glob.on('error', this.onGlobError.bind(this))
          this.glob.on('end', () => {
            this.debug('glob search has finished')
            resolve()
          })
        },
        (err) => reject(err)
      )
    })
  }

  get globOptions () {
    return {
      cwd: this.folder.abs,

      // whether the glob should ignore hidden .dot files
      dot: this.folder.options.ignoreHiddenFiles === false,

      // follow symblinks
      follow: true,

      // do not sort, waste of computing
      nosort: true,

      // report file system errors
      strict: true,

      // add ignore rules
      ignore: this.folder.options.globalIgnores ? ignoreRules : []
    }
  }

  /**
   * onGlobMatch
   * Called whenever Glob finds a match to a file we want to sync
   */
  onGlobMatch (filepath) {
    //
  }

  onGlobError () {
    this.debug('glob error')
  }

  get indexFilePath () {
    return path.join(this.folder.abs, '.syncstuff', 'cache')
  }

  indexFile () {
    return new Promise((resolve, reject) => {
      const indexFilePath = this.indexFilePath
      this.debug('opening index file: %s', indexFilePath)
      const stream = fs.createReadStream(indexFilePath)

      stream.on('open', () => {
        resolve(stream)
      })

      stream.on('error', (err) => {
        // if file does not exist, should mean the folder is new to being synced
        if (err.code === 'ENOENT') {
          this.debug('index file does not exist')
          resolve()
        } else {
          reject(err)
        }
      })
    })
  }

  /**
   * Opens the index cache that is stored in the folder
   */
  readIndexFile () {
    return new Promise((resolve, reject) => {
      this.indexFile().then(
        (indexFileStream) => {
          if (indexFileStream == null) {
            // when stream is null, the index file does not exist
            this.index = {}
            this.debug('set index to empty')
            return resolve()
          }

          this.debug('restoring existing index')

          const rl = readline.createInterface({
            input: indexFileStream
          })

          rl.on('line', (line) => {
            this.debug('readIndexFile: readline: reading line')
            console.log('Line from file:', line)
          })

          rl.on('close', () => {
            this.debug('readIndexFile: readline: close')
            resolve()
          })
        },
        (err) => reject(err)
      )
    })
  }
}

module.exports = FolderIndexer
