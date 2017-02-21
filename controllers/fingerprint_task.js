var machina = require('machina');
var config = require('../config');

var bot = require('../bot');
let msgUtil = require('../message-utils');
var config = require('../config');

var FingerprintPoint = require('../models/fingerprint-point');

var FingerprintTaskFsm = machina.BehavioralFsm.extend({
	namespace: "fingerprint",
	initialState: "load_points",
	states: {
		load_points: {
			_onEnter: function(task) {
				var self = this;
				FingerprintPoint.getPointsForSampling(
					task.get('deployment_id'),
					3
				).then(function(points) {
					task.context = {
						points: points.map(p => ({
							floor: p.get('floor'),
							lat: p.get('lat'),
							long: p.get('long')
						}))
					}
				}).then(function() {
					self.transition(task, "goto");
				});
			}
		},
		goto: {
			_onEnter: function(task) {
				var text = "We need you to help us sample beacon data in the building. Please open the LuzDeploy app below and follow the instructions. Let me know when you are 'done'!";
				var locations = task.context.points.map(p => `${p.floor},${p.lat},${p.long}`).join(';');
				var buttons = [{
 					"type":"web_url", 
 					"title": "Open LuzDeploy", 
					"webview_height_ratio": "compact",
					"messenger_extensions": true,
 					"url": `https://hulop.qolt.cs.cmu.edu/?type=datasampler&major=65535&locations=${locations}&wid=${task.get('volunteer_fbid')}&next=${config.THREAD_URI}&base=${config.BASE_URL}`
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

module.exports = FingerprintTaskFsm;
