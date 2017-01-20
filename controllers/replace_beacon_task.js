var machina = require('machina');

var bot = require('../bot');
let msgUtil = require('../message-utils');

var BeaconSlot = require('../models/beacon-slot');

var ReplaceBeaconTaskFsm = machina.BehavioralFsm.extend({
	namespace: "place_beacons",
	initialState: "supply",
	states: {
		supply: {
			_onEnter: function(task) {
				task.context = {};
				var text = `One of our beacons needs to be replaced because it isn't working. Please go to the pickup location at NSH 4522. Tell me when you are 'there'.`;
				bot.sendMessage(
					task.get('volunteer_fbid'),
					msgUtil.quickReplyMessage(text, ['there'])
				);
			},
			"msg:there": "pickup",
		},
		pickup: {
			_onEnter: function(task) {
				var text = "Great! Please take a replacement beacon. Let me know when you are 'ready'.";
				bot.sendMessage(
					task.get('volunteerFbid'),
					msgUtil.quickReplyMessage(text, ['ready'])
				);
			},
			"msg:ready": 'go',
		},
		go: {
			_onEnter: function(task) {
				var params = task.get('instructionParams');
				var buttons = [{
					"type":"web_url", 
					"title": "Open Map",
					"webview_height_ratio": "tall",
					"messenger_extensions": true,
					"url": `https://hulop.qolt.cs.cmu.edu/mapeditor/?advanced&hidden&beacon=${params.slot}`
				}];
				var text = "Please go to the location marked on the map below. Tell me when you are 'there'.";
				bot.sendMessage(
					task.get('volunteerFbid'),
					msgUtil.buttonMessage(text, buttons)
				);
			},
			"msg:there": "old_beacon",
		},
		old_beacon: {
			_onEnter: function(task) {
				var text = "Is there an existing beacon at this location?";
				bot.sendMessage(
					task.get('volunteerFbid'),
					msgUtil.quickReplyMessage(text, ['yes','no'])
				)
			},
			"msg:yes": function(task) {
				task.context.return = true;
				this.transition(this, "which");
			},
			"msg:no": function(task) {
				task.context.return = false;
				this.transition(this, "which");
			}
		},
		which: {
			_onEnter: function(task) {
				bot.sendMessage(
					task.get('volunteerFbid'),
					{text: `What is the number on the back of the replacement beacon?`}
				);
			},
			number: function(task, id) {
				// TODO: double check if it seems like that beacon doesn't exist or is already placed.
				task.context.currentBeacon = id;
				task.context.return ? this.transition(task, "replace_return") : this.transition(task, "replace");
			}
		},
		replace_return: {
			_onEnter: function(task) {
				// record beacon status as broken and in possession of volunteer
				var text = "Please take down the old beacon and put the new one in it's place. Then return the old beacon to the pickup location. Tell me when you are 'done'."
				bot.sendMessage(
					task.get('volunteerFbid'),
					msgUtil.quickReplyMessage(text, ['done'])
				)
			},
			"msg:done": function(task) {
				this.handle(task, "complete");
			},
		},
		replace: {
			_onEnter: function(task) {
				var text = "Please put the beacon on the wall (you can double check the location using the map above). Tell me when you are 'done'."
				bot.sendMessage(
					task.get('volunteerFbid'),
					msgUtil.quickReplyMessage(text, ['done'])
				)
				// record beacon's status as MIA, look for it.
			},
			"msg:done": function(task) {
				var params = task.get('instructionParams');
				BeaconSlot
				.forge({id: params.slot})
				.save({beaconId: task.context.currentBeacon}, {patch: true})
				.then(console.log);
				this.handle(task, "complete");
			},
		}
	}
});

module.exports = ReplaceBeaconTaskFsm;
