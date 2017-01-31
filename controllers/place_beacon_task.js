var machina = require('machina');

var bot = require('../bot');
let msgUtil = require('../message-utils');

var BeaconSlot = require('../models/beacon-slot');

var Promise = require('bluebird');

var PlaceBeaconsTaskFsm = machina.BehavioralFsm.extend({
	namespace: "place_beacons",
	initialState: "supply",
	states: {
		supply: {
			_onEnter: function(task) {
				var text = "In this task you will place beacons in the environment that will be used by people with visual impairments to navigate. Please go to the Supply Station (NSH 4522). Tell me when you are 'there'.";
				bot.sendMessage(
					task.get('volunteer_fbid'),
					msgUtil.quickReplyMessage(text, ['there'])
				);
			},
			"msg:there": "pickup",
		},
		pickup: {
			_onEnter: function(task) {
				var text = "Great! Now grab as many beacons as you are willing to place. Tell me how many you take (you can press a button or type a number).";
				bot.sendMessage(
					task.get('volunteerFbid'),
					msgUtil.quickReplyMessage(text, ['1','3','5','10'])
				);
			},
			number: function(task, n) {
				task.context = {
					initialBeacons: n,
					numBeacons: n,
					currentSlot: null,
					currentBeacon: null,
				};
				var self = this;
				BeaconSlot.getNSlots(n).then(function(slots) {
					task.context.slots = slots.map(s => s.get('id'));
					bot.sendMessage(
						task.get('volunteerFbid'),
						{text: `Great, you have ${task.context.numBeacons} beacons to place.`}
					);
					return Promise.map(slots, function(slot) {
						return slot.save({in_progress: true});
					});
				}).then(function() {
					self.transition(task, "go");
				});
			},
		},
		go: {
			_onEnter: function(task) {
				task.context.currentSlot = task.context.slots.pop(1);
				var buttons = [{
					"type":"web_url", 
					"title": "Open Map", 
					"webview_height_ratio": "tall",
					"messenger_extensions": true,
					"url": `https://hulop.qolt.cs.cmu.edu/mapeditor/?advanced&hidden&beacon=${task.context.currentSlot}`
				}];
				var text = "Please go to the location marked on the map below. Tell me when you are 'there'.";
				bot.sendMessage(
					task.get('volunteerFbid'),
					msgUtil.buttonMessage(text, buttons)
				);
			},
			"msg:there": "which",
		},
		which: {
			_onEnter: function(task) {
				bot.sendMessage(
					task.get('volunteerFbid'),
					{text: `What is the number on the back of one of the beacons you have?`}
				);
			},
			number: function(task, id) {
				// TODO: double check if it seems like that beacon doesn't exist or is already placed.
				task.context.currentBeacon = id;
				this.transition(task, "place");
			}
		},
		place: {
			_onEnter: function(task) {
				var text = "Place the beacon on the wall (you can double check using the map), and try to make it look neat. Tell me when you are 'done'.";
				bot.sendMessage(
					task.get('volunteerFbid'),
					msgUtil.quickReplyMessage(text, ['done'])
				)
			},
			"msg:done": function(task) {
				BeaconSlot
				.forge({id: task.context.currentSlot})
				.save({beaconId: task.context.currentBeacon}, {patch: true})
				.then(() => {
					task.context.currentBeacon = null;
					task.context.currentSlot = null;
					task.context.numBeacons--;
					if (task.context.numBeacons == 0) {
						this.handle(task, "complete");
					} else {
						bot.sendMessage(
							task.get('volunteerFbid'),
							{text: "Thanks, let's place another!"}
						)
						this.transition(task, "go");
					}
				}).catch(console.log);
			}
		}
	}
});

module.exports = PlaceBeaconsTaskFsm;
	