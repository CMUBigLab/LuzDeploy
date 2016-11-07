var machina = require('machina');

var bot = require('../bot');

var PlaceBeaconTaskFsm = machina.BehavioralFsm.extend({
	initialize: function(options) {
	},
	initialState: "uninitialized",
	states: {
		uninitialized: {
			"start": function(client) {
				client.context = {numBeacons: 0, slots: [], beacons: []};
				this.transition(client, "pickup");
			},
		},
		pickup: {
			_onEnter: function(client) {
				// should send instructions here
				return client.start();
			},
			"pickup-complete": function(client, number) {
				// need to validate number
				client.context.numBeacons = number;
				this.transition(client, "which");
			},
		},
		which: {
			_onEnter: function(client) {
				// should send instructions here
			},
			response: function(cleint, id) {
				// need to validate id
				client.beacons.push(id);
				this.transition(client, "go");
			}
		},
		go: {
			_onEnter: function(client) {
				// get slot number
				// instructions to go to slot location
				// push slots into client.context.slots
			}
		},
		place: {
			placed: function(client) {
				// save slot <-> beacon relationship
				client.context.numBeacons--;
				if (client.context.numBeacons == 0) {
					this.transition(client, "complete");
				} else {
					this.transition(client, "which");
				}
			}
		}
		complete: {
			_onEnter: function(client) {
				return client.finish();
			}
		}
	}
});
