const machina = require("machina");
import * as Promise from "bluebird";
import * as _ from "lodash";

import {bot} from "../bot";
import * as msgUtil from "../message-utils";
import {Task} from "../models/task";
import {Volunteer, Deployment} from "../models";

import {SweepTaskFsm} from "./sweep_task";
import {PlaceBeaconsTaskFsm} from "./place_beacon_task";
import {ReplaceBeaconTaskFsm} from "./replace_beacon_task";
import {FingerprintTaskFsm} from "./fingerprint_task";

export interface TaskController {
    getNewTask: (Volunteer) => Promise<Task>;
}

export const taskControllers = {
    sweep_edge: <TaskController> new SweepTaskFsm(),
    place_beacons: <TaskController> new PlaceBeaconsTaskFsm(),
    replace_beacon: <TaskController> new ReplaceBeaconTaskFsm(),
    fingerprint: <TaskController> new FingerprintTaskFsm(),
};

export function getTaskPool(vol: Volunteer): Promise<Task[]> {
    return Promise.map(Object.values(taskControllers), tc => tc.getNewTask(vol))
    .then(pool => pool.filter(t => t != null));
}

function rejectTask(task: Task): Promise<any> {
    return task.assignedVolunteer().fetch()
    .then(function(vol) {
        return vol.unassignTask();
    }).spread(function(vol: Volunteer, task: Task) {
        let text = "Task rejected. If you wish to continue, you can 'ask' for another random task.";
        return vol.sendMessage(msgUtil.quickReplyMessage(text, ["ask"]));
    }).then(() => this.transition(task, "unassigned"));
}

export const TaskFsm = new machina.BehavioralFsm({
    namespace: "task",
    initialState: "unassigned",
    states: {
        unassigned: {
            _onEnter: () => {},
            assign: "assigned",
        },
        assigned: {
            _onEnter: () => {},
            start: "started",
            reject: rejectTask,
            "msg:reject": rejectTask
        },
        started: {
            _child: function(task: Task) {
                let controller = taskControllers[task.templateType];
                if (!controller) {
                    throw new Error("no FSM defined for this task type");
                }
                return controller;
            },
            "msg:reject": rejectTask,
            reject: rejectTask,
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
        .tap((task) => this.handle(task, "assign"));
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

TaskFsm.on("transitioned", function(event) {
    event.client.saveState();
});

TaskFsm.on("taskComplete", function(task: Task, vol: Volunteer) {
    // TODO: This should really be handled in a hierarchy with a deployment FSM
    return task.deployment().fetch()
    .then((deployment: Deployment) => {
        return getTaskPool(vol)
        .then((pool) => {
            if (pool.length > 0) {
                if (!deployment.isCasual) {
                    return vol.getNewTask()
                    .then(function(newTask) {
                        if (!newTask) {
                            return vol.sendMessage({text: "Thanks! There are no tasks available right now."});
                        } else {
                            return newTask.save()
                            .then(t => TaskFsm.assign(t, vol))
                            .then(t => TaskFsm.start(newTask));
                        }
                    });
                } else {
                    let text = "Thanks! There are more tasks available! Say 'ask' to get another.";
                    if (task.compensation > 0) {
                        console.log("compensation for task:", task.compensation);
                        text = `Thanks, you earned $${task.compensation.toFixed(2)}. There are more tasks available! Say 'ask' to get another.`;
                    }
                    vol.sendMessage(
                        msgUtil.quickReplyMessage(text, ["ask"])
                    );
                }
            } else {
                vol.sendMessage({text: "Thanks! There are no more tasks available right now."});
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