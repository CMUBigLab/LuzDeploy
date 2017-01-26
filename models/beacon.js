const Promise = require('bluebird')
const _ = require('lodash')

const bookshelf = require('../bookshelf')

require('./beacon-slot')
require('./volunteer')
require('./base-model')
const Beacon = bookshelf.model('BaseModel').extend({
	tableName: 'beacons',
	slot: function() {
		return this.belongsTo(bookshelf.model('BeaconSlot'));
	},
	heldBy: function() {
		return this.belongsTo(bookshelf.model('Volunteer'))
	}
})

module.exports = bookshelf.model('Beacon', Beacon)