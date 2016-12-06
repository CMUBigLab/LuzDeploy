var Promise = require('bluebird');
var	 _ = require('lodash');

var bookshelf = require('../bookshelf');

require('./beacon')
require('./base-model')
var BeaconSlot = bookshelf.model('BaseModel').extend({
	tableName: 'beacon_slots',
	beacon: function() {
		return this.hasOne(bookshelf.model('Beacon'));
	},
}, {
	getNSlots: function(n) {
		return this.collection().query({where: {beacon_id: null}}).fetch()
		.then(function(slots) {
			// TODO: Be smarter about finding clusters of beacons
			return slots.sortBy('floor').slice(0, n);
		});
	}
});

module.exports = bookshelf.model('BeaconSlot', BeaconSlot);