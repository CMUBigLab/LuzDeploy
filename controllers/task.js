var machina = require('machina');

var bot = require('../bot');
let msgUtil = require('../message-utils');
var Promise = require('bluebird');
var _ = require('lodash');

var SweepTaskFsm = require('./sweep_task');
var PlaceBeaconFsm = require('./place_beacon_task');
var ReplaceBeaconFsm = require('./replace_beacon_task');
var taskControllers = {
	sweep_edge: new SweepTaskFsm(),
	place_beacon: new PlaceBeaconFsm(),
	replace_beacon: new ReplaceBeaconFsm(),
}

function rejectTask(task) {
	return task.assignedVolunteer().fetch()
	.then(function(vol) {
		return vol.unassignTask()
	})
	.spread(function(vol, task) {
		vol.sendMessage({text: "Task rejected. If you wish to continue, you can 'ask' for another."});
	}).then(() => this.transition(task, 'unassigned'))
}

var TaskFsm = new machina.BehavioralFsm({
	namespace: "task",
	initialState: "unassigned",
	states: {
		unassigned: {
			assign: "assigned",
		},
		assigned: {
			start: "started",
			"msg:reject": rejectTask
		},
		started: {
			_child: function(task) {
				var controller = taskControllers[task.get('templateType')];
				if (!controller) {
					throw new Error('no FSM defined for this task type')
				}
				return controller;
			},
			"msg:reject": rejectTask,
			complete: "complete"
		},
		complete: {
			_onEnter: function(task) {
				var volunteer = null;
				task.assignedVolunteer().fetch()
				.then(function(vol) {
					volunteer = vol;
					return Promise.all([task.finish(), vol.completeTask()])
				})
				.then(() => this.emit('taskComplete', task, volunteer))
			}
		}
	},
	assign: function(task, vol) {
		return vol.assignTask(task)
		.then(() => this.handle(task, 'assign'));
	},
	start: function(task) {
		return task.start()
		.then(() => this.handle(task, 'start'));
	},
	userMessage: function(task, message) {
		var n = parseInt(message, 10);
		if (!isNaN(n)) {
			this.handle(task, 'number', n);
		} else {
			this.handle(task, 'msg:' + message);
		}
	},
	webhook: function(task, message) {
		this.handle(task, 'webhook:' + message);
	}
});

TaskFsm.on('transitioned', function(event) {
	event.client.saveState();
});

TaskFsm.on('taskComplete', function(task, vol) {
	// This should really be handled in a hierarchy with a deployment FSM
	return task.deployment().fetch()
	.then((deployment) => {
		return deployment.isComplete()
		.then(function(complete) {
			if (complete) {
				return deployment.finish()
			} else {
				return deployment.getTaskPool()
				.then((pool) => {
					if (pool.length > 0) {
						if (!deployment.isCasual) {
							return vol.getNewTask()
							.then(function(newTask) {
								if (!newTask) {
									return vol.sendMessage({text: 'Thanks! There are no tasks available right now.'})
								} else {
									TaskFsm.assign(newTask, vol)
									.then(function() {
										TaskFsm.start(newTask);
									});
								}
							})
						} else {
							vol.sendMessage({text: "Thanks! There are more tasks available! Say 'ask' to get another."});
						}
					} else {
						vol.sendMessage({text: "Thanks! There are no more tasks available right now."})
					}
				});
			}
		});
	});
});

TaskFsm.on('nohandler', function(event) {
	event.client.assignedVolunteer().fetch()
	.then(function(vol) {
		if (event.inputType.startsWith('msg:')) {
			vol.sendMessage({text: `Sorry, this task can't handle "${event.inputType.slice(4)}".`})
		} else {
			throw new Error(`no handler defined for ${event.inputType}`)
		}
	});
});

module.exports = TaskFsm;
