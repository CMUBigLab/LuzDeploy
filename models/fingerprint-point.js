const Promise = require('bluebird')
const _ = require('lodash')

const bookshelf = require('../bookshelf')

require('./base-model')
const FingerprintPoint = bookshelf.model('BaseModel').extend({
	tableName: 'fingerprint_point'
})

module.exports = bookshelf.model('FingerprintPoint', FingerprintPoint)