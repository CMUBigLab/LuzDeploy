var machina = require('machina');

var bot = require('../bot');
let msgUtil = require('../message-utils');

var SweepTaskFsm = machina.BehavioralFsm.extend({
	namespace: "sweep_edge",
	initialState: "goto",
	states: {
		goto: {
			_onEnter: function(task) {
				var text = "We need you to help us check which beacons are not working in the building. Please go to one of the ends of the path highlighted in red on this map. Let me know when you are 'there'!";
				var params = task.get('instructionParams');
				var buttons = [{
					"type":"web_url", 
					"title": "Open Map", 
					"url": `http://hulop.qolt.cs.cmu.edu/mapeditor/?advanced&hidden&edge=${params.edge}`
				}];
				bot.sendMessage(
					task.get('volunteer_fbid'),
					msgUtil.buttonMessage(text, buttons)
					);
			},
			"msg:there": "sweep",
		},
		sweep: {
			_onEnter: function(task) {
				var text = "Great! Now, use the link below to open NavCog and press the button to start. Then walk to the end of the path, and press the button again to stop. Let me know when you are 'done'!";
				var params = task.get('instructionParams');
				var buttons = [{
					"type":"web_url", 
					"title": "Open NavCog", 
					"url": `http://hulop.qolt.cs.cmu.edu/?type=beaconsweeper&major=65535&beaconlist=${params.beacons}&wid=${task.get('volunteerFbid')}`
				}];
				bot.sendMessage(
					task.get('volunteerFbid'),
					msgUtil.buttonMessage(text, buttons)
					);
			},
			"msg:done": function(task) {
				this.handle(task, "complete");
			}
		},
	}
});

module.exports = SweepTaskFsm;
