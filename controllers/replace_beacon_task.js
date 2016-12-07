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
				var text = `One of our beacons needs to be replaced because it isn't working. Please got to the pickup location at NSH 4522. Tell me when you are 'there'.`;
				bot.sendMessage(
					task.get('volunteer_fbid'),
					msgUtil.quickReplyMessage(text, ['there'])
				);
			},
			"msg:there": "pickup",
		},
		pickup: {
			_onEnter: function(task) {
				var params = task.get('instructionParams');
				var text = `Great! Please take a replacement for beacon number ${params.beacon}. Let me know when you are 'ready'.`;
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
					"url": `http://hulop.qolt.cs.cmu.edu/mapeditor/?advanced&hidden&beacon=${params.beacon}`
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
			"msg:yes": "replace_return",
			"msg:no": "replace",
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
				this.handle(task, "complete");
			},
		}
	}
});

module.exports = ReplaceBeaconTaskFsm;
