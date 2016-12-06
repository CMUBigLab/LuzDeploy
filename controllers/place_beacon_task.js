var machina = require('machina');

var bot = require('../bot');
let msgUtil = require('../message-utils');

var BeaconSlot = require('../models/beacon-slot');

var PlaceBeaconsTaskFsm = machina.BehavioralFsm.extend({
	namespace: "place_beacons",
	initialState: "supply",
	states: {
		supply: {
			_onEnter: function(task) {
				var text = "In this task you will place beacons in the environment that will be used by people with visual impairments to navigate. Please go to the Supply Station (GHC 5th floor entrance). Tell me when you are 'there'.";
				bot.sendMessage(
					task.get('volunteer_fbid'),
					msgUtil.quickReplyMessage(text, ['there'])
				);
			},
			"msg:there": "pickup",
		},
		pickup: {
			_onEnter: function(task) {
				var text = "Great! Now grab as many beacons as you are willing to place. Tell me how many you take.";
				bot.sendMessage(
					task.get('volunteerFbid'),
					msgUtil.quickReplyMessage(text, ['1','3','5','10'])
				);
			},
			"*": function(task, number) {
				// chop off msg: prefix
				number = number.slice(4);
				var n = parseInt(number, 10);
				if (isNaN(n)) {
					bot.sendMessage(
						task.get('volunteerFbid'),
						{text: `Hm, I couldn't figure out how many beacons you have from '${number}'. Try a number.`}
					);
					return;
				}
				task.context = {
					initialBeacons: n,
					numBeacons: n,
					currentSlot: null,
					currentBeacon: null,
				};
				var self = this;
				BeaconSlot.getNSlots(n).then(function(slots) {
					task.context.slots = slots;
					self.transition(task, "go");
				});
				bot.sendMessage(
					task.get('volunteerFbid'),
					{text: `Great, you have ${task.context.numBeacons} beacons to place.`}
				);
			},
		},
		go: {
			_onEnter: function(task) {
				task.context.currentSlot = task.context.slots.pop(1);
				var buttons = [{
					"type":"web_url", 
					"title": "Open Map", 
					"url": `http://hulop.qolt.cs.cmu.edu/mapeditor/?advanced&hidden&beacon=${task.context.currentSlot}`
				}];
				bot.sendMessage(
					task.get('volunteer_fbid'),
					{text: `Please go to the location marked on the map below. Tell me when you are 'there'.`}
				);
			},
			"msg:there": "which",
		},
		which: {
			_onEnter: function(task) {
				bot.sendMessage(
					task.get('volunteerFbid'),
					{text: `What is the number on the back of one of the beacons?`}
				);
			},
			"*": function(task, number) {
				number = number.slice(4);
				var id = parseInt(number, 10);
				if (isNaN(id)) {
					bot.sendMessage(
						task.get('volunteerFbid'),
						{text: `'${number}' doens't look like a beacon id. Try a number.`}
					);
					return;
				}
				// TODO: double check if it seems like that beacon doesn't exist or is already placed.
				task.context.currentBeacon = id;
				this.transition(task, "place");
			}
		},
		place: {
			_onEnter: function(task) {
				var text = "Place beacon on the wall (you can double check using the map), and try to make it look neat. Tell me when you are 'done'.";
				bot.sendMessage(
					task.get('volunteerFbid'),
					msgUtil.quickReplyMessage(text, ['done'])
				)
			},
			"msg:done": function(task) {
				task.context.currentSlot.beaconId = task.context.currentBeacon.id;
				task.context.currentSlot.save();
				task.context.numBeacons--;
				if (task.context.numBeacons == 0) {
					this.handle(task, "complete");
				} else {
					bot.sendMessage(
						task.get('volunteerFbid'),
						{text: "Thanks, let's place another!"}
					)
					this.transition(task, "which");
				}
			}
		}
	}
});

module.exports = PlaceBeaconsTaskFsm;
