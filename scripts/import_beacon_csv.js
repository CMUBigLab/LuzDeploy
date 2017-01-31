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
			deploymentId: 3,
		}).save(null, {method: 'insert'})
		.then(function(slot) {
			return Beacon.forge({
				id: b.bid,
				minorId: b.minor,
				slot: slot.id,
				deploymentId: 3,
			}).save(null, {method: 'insert'})
			.then(function(beacon) {
				return slot.save({beaconId: beacon.id}, {method: 'update'});
			})
		}).then(() => process.exit())
		.catch(err => { 
			console.log(err)
			process.exit(1)
		});
	});
});

fs.createReadStream(__dirname+'/Beacons.csv').pipe(parser);