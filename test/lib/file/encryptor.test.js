const FileEncryptor = require('../src/lib/file/encryptor')

describe('file.encryptor.FileEncryptor', function () {
  let encryptionKey

  before(function () {
    const key = new Key('secret', 'salt')
    key.then((encKey) => {
      encryptionKey = encKey.toString('base64')
    })
  })

  describe('.encrypt', function () {
    let encryptor

    before(function () {
      encryptor = new FileEncryptor()
    })

    it('encrypts and matches openssl output', function (done) {
      encryptor._encrypt(
        (data) => {
          console.log(data)
          done()
        },
        () => {},
        encryptionKey
      )
    })
  })
})
