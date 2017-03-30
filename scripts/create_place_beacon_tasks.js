var BeaconSlot = require('../models/beacon-slot');
var Beacon = require('../models/beacon');
var Task = require('../models/task');

var Promise = require('bluebird');

BeaconSlot.collection()
.query('where','beacon_id', 'is not', null)
.fetch({withRelated: 'beacon'})
.then(function(slots) {
	var edges = slots.groupBy('edge');
	return Promise.map(Object.keys(edges), function(edge) {
		var beaconSlots = edges[edge];
		return Task.forge({
			deploymentId: 3,
			templateType: 'sweep_edge',
			instructionParams: {
				edge: edge,
				start: beaconSlots[0].startNode,
				end: beaconSlots[0].endNode,
				beacons: getRanges(
					beaconSlots.map(s => s.related('beacon').minorId)
					.sort()
				),
			}
		}).save();
	})
})
.then(() => process.exit())
.catch(err => { 
	console.log(err)
	process.exit(1)
});