var fs = require('fs');
var parse = require('csv-parse');
var Beacon = require('../models/beacon');
var BeaconSlot = require('../models/beacon-slot');
var Promise = require('bluebird');

var parser = parse({delimiter: ',', columns: true}, function(err, data){
	return Promise.map(data, function(b) {
		return BeaconSlot.forge({
			id: b.bid,
			lat: b.lat,
			long: b.lng,
			edge: b.edge,
			floor: b.floor,
			startNode: b.start,
			endNode: b.end,
		}).save(null, {method: 'insert'})
		.then(function(slot) {
			return Beacon.forge({
				id: b.bid,
				minorId: b.minor,
				slot: slot.id,
			}).save(null, {method: 'insert'})
			.then(function(beacon) {
				return slot.save({beaconId: beacon.id}, {method: 'update'});
			})
		}).catch(function(err) {
			console.log(err);
		});
	});
});

fs.createReadStream(__dirname+'/Beacons.csv').pipe(parser);