var BeaconSlot = require('../models/beacon-slot');
var Task = require('../models/task');

var Promise = require('bluebird');

// adapted from https://stackoverflow.com/questions/2270910
function getRanges(array) {
  var ranges = [], rstart, rend;
  for (var i = 0; i < array.length; i++) {
    rstart = array[i];
    rend = rstart;
    while (array[i + 1] - array[i] == 1) {
      rend = array[i + 1]; // increment the index if the numbers sequential
      i++;
    }
    ranges.push(rstart == rend ? rstart.toString() : rstart + '-' + rend);
  }
  return ranges.join();
}

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
				start: beaconSlots[0].get('startNode'),
				end: beaconSlots[0].get('endNode'),
				beacons: getRanges(
					beaconSlots.map(s => s.related('beacon').get('minorId'))
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