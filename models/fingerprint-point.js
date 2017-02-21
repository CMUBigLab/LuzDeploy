const Promise = require('bluebird')
const _ = require('lodash')

const bookshelf = require('../bookshelf')

require('./base-model')
const FingerprintPoint = bookshelf.model('BaseModel').extend({
	tableName: 'fingerprint_point',
	samples: function() {
		this.hasMany(bookshelf.model('FingerprintSample'), 'fingerprint_id');
	}
}, {
	getPointsForSampling: function(deploymentId, limit) {
		limit = limit || 1;
		return this.fetchAll({withRelated: ['samples']})
		.then(function(points) {
			return points.sortBy(function(p) {
				return p.related('samples').length;
			}).slice(0, limit);
		})
 },
})

module.exports = bookshelf.model('FingerprintPoint', FingerprintPoint)