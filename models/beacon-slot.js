var Promise = require('bluebird');
var	 _ = require('lodash');

var bookshelf = require('../bookshelf');

require('./beacon-slot')
require('./base-model')
var BeaconSlot = bookshelf.model('BaseModel').extend({
	tableName: 'beacon_slots',
	beacon: function() {
		return this.hasOne(bookshelf.model('Beacon'));
	})
});

module.exports = bookshelf.model('BeaconSlot', BeaconSlot);