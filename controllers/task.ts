const machina = require("machina");
import * as Promise from "bluebird";
import * as _ from "lodash";

import {bot} from "../bot";
import * as msgUtil from "../message-utils";
import {Task} from "../models/task";
import {Volunteer} from "../models/volunteer";

import {SweepTaskFsm} from "./sweep_task";
import {PlaceBeaconsTaskFsm} from "./place_beacon_task";
import {ReplaceBeaconTaskFsm} from "./replace_beacon_task";
import {FingerprintTaskFsm} from "./fingerprint_task";
export const taskControllers = {
    sweep_edge: new SweepTaskFsm(),
    place_beacons: new PlaceBeaconsTaskFsm(),
    replace_beacon: new ReplaceBeaconTaskFsm(),
    fingerprint: new FingerprintTaskFsm(),
};

function rejectTask(task: Task) {
    return task.assignedVolunteer().fetch()
    .then(function(vol) {
        return vol.unassignTask();
    }).spread(function(vol: Volunteer, task: Task) {
        let text = "Task rejected. If you wish to continue, you can 'ask' for another.";
        vol.sendMessage(msgUtil.quickReplyMessage(text, ["ask"]));
    }).then(() => this.transition(task, "unassigned"));
}

export const TaskFsm = new machina.BehavioralFsm({
    namespace: "task",
    initialState: "unassigned",
    states: {
        unassigned: {
            assign: "assigned",
        },
        assigned: {
            start: "started",
            reject: rejectTask,
            "msg:reject": rejectTask
        },
        started: {
            _child: function(task) {
                let controller = taskControllers[task.get("templateType")];
                if (!controller) {
                    throw new Error("no FSM defined for this task type");
                }
                return controller;
            },
            "msg:reject": rejectTask,
            complete: "complete"
        },
        complete: {
            _onEnter: function(task) {
                let volunteer = null;
                task.assignedVolunteer().fetch()
                .then(function(vol) {
                    volunteer = vol;
                    return Promise.all([task.finish(), vol.completeTask()]);
                })
                .then(() => this.emit("taskComplete", task, volunteer));
            }
        }
    },
    assign: function(task, vol) {
        return vol.assignTask(task)
        .then(() => this.handle(task, "assign"));
    },
    start: function(task) {
        return task.start()
        .then(() => this.handle(task, "start"));
    },
    reject: function(task) {
        return this.handle(task, "reject");
    },
    userMessage: function(task, message) {
        let n = parseInt(message, 10);
        if (!isNaN(n)) {
            this.handle(task, "number", n);
        } else {
            this.handle(task, "msg:" + message);
        }
    },
    webhook: function(task, message) {
        this.handle(task, "webhook:" + message);
    }
});

TaskFsm.on("transition", function(event) {
    console.log("transition", event);
});

TaskFsm.on("transitioned", function(event) {
    console.log("transitioned", event);
    event.client.saveState();
});

TaskFsm.on("taskComplete", function(task, vol) {
    // TODO: This should really be handled in a hierarchy with a deployment FSM
    return task.deployment().fetch()
    .then((deployment) => {
        return deployment.isComplete()
        .then(function(complete) {
            if (complete) {
                return deployment.finish();
            } else {
                return deployment.getTaskPool()
                .then((pool) => {
                    if (pool.length > 0) {
                        if (!deployment.isCasual) {
                            return vol.getNewTask()
                            .then(function(newTask) {
                                if (!newTask) {
                                    return vol.sendMessage({text: "Thanks! There are no tasks available right now."});
                                } else {
                                    TaskFsm.assign(newTask, vol)
                                    .then(function() {
                                        TaskFsm.start(newTask);
                                    });
                                }
                            });
                        } else {
                            let text = "Thanks! There are more tasks available! Say 'ask' to get another.";
                            vol.sendMessage(
                                msgUtil.quickReplyMessage(text, ["ask"])
                            );
                        }
                    } else {
                        vol.sendMessage({text: "Thanks! There are no more tasks available right now."});
                    }
                });
            }
        });
    });
});

TaskFsm.on("nohandler", function(event) {
    event.client.assignedVolunteer().fetch()
    .then(function(vol) {
        if (event.inputType.startsWith("msg:")) {
            vol.sendMessage({text: `Sorry, this task can't handle "${event.inputType.slice(4)}".`});
        } else if (event.inputType === "number") {
            vol.sendMessage({text: `Sorry, I don't know what to do with that number.`});
        } else {
            throw new Error(`no handler defined for ${event.inputType}`);
        }
    });
});