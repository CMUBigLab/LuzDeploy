const bookshelf = require('../bookshelf')

require('./base-model')
const Consent = bookshelf.model('BaseModel').extend({
  tableName: 'consent',
  idAttribute: 'fbid',
})

module.exports = bookshelf.model('Consent', Consent)