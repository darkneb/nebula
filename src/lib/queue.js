const path = require('path')
const fs = require('graceful-fs')
const debug = require('./debug')(__filename)
const Events = require('./events')

class Queue extends Events {
  constructor () {
    super()

    this.queue = []
    this.handlers = {}
    this.status = 'free'

    // load all the handlers
    try {
      const jobsDirectory = path.join(__dirname, 'jobs')
      const files = fs.readdirSync(jobsDirectory)

      files.forEach((filename) => {
        debug('found job handler %s', filename)
        const file = path.join(jobsDirectory, filename)
        this.handlers[filename.replace(/\.js$/, '')] = require(file)
      })
    } catch (ex) {
      console.error(ex)
      process.exit()
    }
  }

  /**
   * Start processing the queue
   */
  start () {
    if (this.status === 'free') {
      this.runJob()
    }
    return this
  }

  /**
   * Run a single job in the queue
   */
  runJob () {
    if (this.queue.length === 0) {
      return debug('no jobs in queue, nothing to run')
    }

    // we are now running a job
    this.status = 'busy'

    // find the job to run
    const job = this.queue.shift()

    // ensure this job can start now, if not, add it back to bottom of queue
    if (job.dontStartUntil && job.dontStartUntil > Date.now()) {
      this.queue.push(job)

      // make sure we don't get into a loop here
      process.nextTick(() => {
        if (this.queue.length === 1) {
          this.status = 'free'

          setTimeout(
            this.start.bind(this),
            Math.max(job.dontStartUntil - Date.now(), 0)
          )
        } else {
          this.moveOn()
        }
      })

      return
    }

    // start the job
    job.emit('started', job, this)

    // process the job
    const cb = this.handlers[job.type]

    if (typeof cb !== 'function') {
      return debug('no job handler defined for %s', job.type)
    }

    cb(job).then(
      () => {
        debug('job %s finished', job.type)
        this.moveOn()
      },
      (err) => {
        // record the error
        debug('wow! job had an error!')
        console.error(err)
        console.log(job)

        // still need to move on
        this.moveOn()
      }
    )
  }

  moveOn () {
    this.status = 'free'
    this.start()
  }

  process (type, cb) {
    debug('job handler registered for %s jobs', type)
    this.handlers[type] = cb
    return this
  }

  /**
   * Clear the queue. When a job type is passed, only clears jobs for that type
   * otherwise will empty the entire queue
   *
   * @param {string|function|null} type Optional filter for type of jobs to clear
   */
  clearQueue (type) {
    if (type == null) {
      debug('clearing queue')
      this.queue = []
    } else if (typeof type === 'string') {
      debug('clearing queue of all %s jobs', type)
      this.queue = this.queue.filter(function (job) {
        return job.type !== type
      })
    } else if (typeof type === 'function') {
      debug('clearing queue using custom filter function')
      this.queue = this.queue.filter(type)
    }
    return this
  }

  /**
   * create
   * Create a new job
   */
  create (type, params = {}) {
    debug('job created: %s (%s)', type, JSON.stringify(params))
    this.emit('before job', type, params, this)

    const job = new Job(type, params)

    job.on('add', () => {
      this.queue.push(job)
      this.start()
    })

    return job
  }
}

class Job extends Events {
  constructor (type, params) {
    super()
    this.type = type
    this.params = params
  }

  delay (ms) {
    this.delay = ms
    this.dontStartUntil = Date.now() + ms
    return this
  }

  /**
   * add
   * Add job to queue
   */
  save () {
    this.emit('add', this)
    return this
  }
}

module.exports = Queue
