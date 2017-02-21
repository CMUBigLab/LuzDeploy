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
		this.fetchAll({withRelated: ['sample']})
		.then(function(points) {
			return points.sortBy(function(p) {
				return p.related('samples').length;
			}).slice(0, limit);
		})
 },
})

module.exports = bookshelf.model('FingerprintPoint', FingerprintPoint)