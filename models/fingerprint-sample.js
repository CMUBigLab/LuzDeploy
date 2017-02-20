const Promise = require('bluebird')
const _ = require('lodash')

const bookshelf = require('../bookshelf')

require('./base-model')
const FingerprintSample = bookshelf.model('BaseModel').extend({
	tableName: 'sample'
})

module.exports = bookshelf.model('FingerprintSample', FingerprintSample)