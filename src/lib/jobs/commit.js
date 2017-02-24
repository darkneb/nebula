module.exports = function (job) {
  return new Promise((resolve, reject) => {
    const folderId = job.params.folderId
    const folder = global.appConfig.getFolderById(folderId)

    if (folder == null) {
      return reject(new Error('folder not found'))
    }

    const git = folder.git
    let messageLines = job.params.messageLines || []

    // at this moment, clear out all items from the job queue that would
    // cause this folder to do a commit, since they're all about to get
    // committed together.

    global.queue.clearQueue(function (job) {
      if (job.params.folderId === folderId) {
        // add this job's message array
        messageLines = messageLines.concat(job.params.messageLines)

        // remove this one from the job queue
        return false
      }

      // clear this one in the job queue
      return true
    })

    git.indexAll().then(
      () => {
        let message = messageLines.join('\n')

        if (message.length === 0) {
          message = 'no message provided'
        }

        git.commit(message).then(
          () => {
            // git objects have been updated, upload files to storage providers
            global.queue.create('sync', {
              folderId: folderId
            }).save()

            // finish this job
            resolve()
          },
          (err) => reject(err)
        )
      },
      (err) => reject(err)
    )
  })
}
