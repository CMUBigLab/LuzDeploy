var machina = require('machina');

var bot = require('../bot');
let msgUtil = require('../message-utils');

var SweepTaskFsm = machina.BehavioralFsm.extend({
	namespace: "sweep_edge",
	initialState: "goto",
	states: {
		goto: {
			_onEnter: function(task) {
				var text = "We need you to help us check which beacons are not working in the building. Please open NavCog below and follow the instructions. Let me know when you are 'done'!";
				var params = task.get('instructionParams');
				var buttons = [{
 					"type":"web_url", 
 					"title": "Open NavCog", 
 					"url": `http://hulop.qolt.cs.cmu.edu/?type=beaconsweeper&major=65535&edge=${params.edge}&beaconlist=${params.beacons}&wid=${task.get('volunteer_fbid')}&start=${params.start}&end=${params.end}&next=${config.THREAD_URI}`
 				}];
				bot.sendMessage(
					task.get('volunteer_fbid'),
					msgUtil.buttonMessage(text, buttons)
					);
			},
			"msg:done": function(task) {
				this.handle(task, "complete");
			},
			"webhook:done": function(task) {
				this.handle(task, "complete");
			}
		},
	}
});

module.exports = SweepTaskFsm;
