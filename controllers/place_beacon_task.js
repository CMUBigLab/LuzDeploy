var machina = require('machina');

var bot = require('../bot');
let msgUtil = require('../message-utils');

var BeaconSlot = require('../models/beacon-slot');
var Beacon = require('../models/beacon');

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
					toReturn: [],
				};
				var self = this;
				BeaconSlot.getNSlots(n).then(function(slots) {
					task.context.slots = slots.map(s => s.get('id'));
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
				var text = `You have ${task.context.numBeacons} beacons to place. Please go to the location marked on the map below.`;
				bot.sendMessage(
					task.get('volunteerFbid'),
					msgUtil.buttonMessage(text, buttons),
					function() {
						bot.sendMessage(
							task.get('volunteerFbid'),
							msgUtil.quickReplyMessage("Tell me when you are 'there'!", ['there'])
						);
					}
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
				var self = this;
				Beacon.forge({id: id}).fetch({require: true})
				.then(function(beacon) {
					if (beacon.get('slot') == null) {
						task.context.currentBeacon = id;
						self.transition(task, "place");
					} else {
						self.transition(task, "already_placed");
					}
				})
				.catch(Beacon.NotFoundError, function() {
					bot.sendMessage(
						task.get('volunteerFbid'),
						{text: `Are you sure? I can't find that beacon. Please try again.`}
					);
				});
			}
		},
		already_placed: {
			_onEnter: function(task) {
				bot.sendMessage(
					task.get('volunteerFbid'),
					msgUtil.quickReplyMessage(`Are you sure? That beacon looks like it has already been placed.`, ["yes", "no"])
				);
			},
			"msg:yes": function(task) {
				task.context.toReturn.push(task.context.currentBeacon);
				task.context.currentBeacon = null;
				task.context.numBeacons--;
				task.context.slots.pop(1);
				if (task.context.numBeacons == 0) {
					this.transition(task, "return");
				} else {
					bot.sendMessage(
						task.get('volunteerFbid'),
						{text: 'Later, please return that beacon to the supply station. For now we will plave another beacon.'}
					);
					this.transition(task, "which");
				}
			},
			"msg:no": "which"
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
						if (task.context.toReturn.length > 0) {
							this.transition(task, "return");
						} else {
							this.handle(task, "complete");
						}
					} else {
						bot.sendMessage(
							task.get('volunteerFbid'),
							{text: "Thanks, let's place another!"}
						)
						this.transition(task, "go");
					}
				}).catch(console.log);
			}
		},
		return: {
			_onEnter: function(task) {
				bot.sendMessage(
					task.get('volunteerFbid'),
					msgUtil.quickReplyMessage("Please return your extra beacon(s) to NSH 4522. Let me know when you are 'done'.", ["done"])
				);
			},
			"msg:done": function(task) {
				this.handle(task, "complete");
			}
		}
	}
});

module.exports = PlaceBeaconsTaskFsm;
	