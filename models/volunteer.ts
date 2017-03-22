import { BaseModel } from "./base";
import * as _ from "lodash";
import * as Promise from "bluebird";
import * as moment from "moment";

import {bot} from "../bot";
import * as handlers from "../handlers";
import bookshelf = require("../bookshelf");
import * as msgUtil from "../message-utils";
import {Deployment} from "./deployment";
import {Task} from "./task";

export class Volunteer extends BaseModel<Volunteer> {
    get tableName() { return "volunteers"; }
    get idAttribute() { return "fbid"; }
    currentTask() {
        return this.belongsTo(Task, "current_task");
    }
    deployment() {
        return this.belongsTo(Deployment);
    }

    constructor(params: any = {}) {
        super(params);
    }

    // columns
    get fbid(): string { return this.get("fbid"); }
    get firstName(): string { return this.get("first_name"); }
    get username(): string { return this.get("username"); }

    assignTask(task: Task) {
        return Promise.join(
            this.save({currentTask: task.id}, {patch: true}),
            task.save({volunteer_fbid: this.id}, {patch: true}),
            (vol, task) => { return task; });
    }
    getNewTask() {
        return this.deployment().fetch()
        .then((deployment: Deployment) => {
            return deployment.getTaskPool()
        }).then(pool => {
            return (pool.length > 0) ? pool.pop() : null;
        });
    }
    getAverageExpertise() {
        return Task.collection()
        .query({
            volunteer_fbid: this.get("fbid"),
            completed: true
        })
        .query("where", "score", "is not", null)
        .fetch()
        .then(tasks => {
            const total = _.sum(tasks.map(t => t.get("score")));
            return tasks.length ? total / tasks.length : 0;
        });
    }
    getAverageTime() {
        return Task.collection()
        .query({
            volunteer_fbid: this.get("fbid"),
            completed: true
        }).query("where", "completed_time", "is not", null)
        .query("where", "start_time", "is not", null)
        .fetch()
        .then(tasks => {
            const total = _.sum(tasks.map(t => t.get("timeScore")));
            return tasks.length ? total / tasks.length : 0;
        });
    }
    completeTask() {
        return this.save({currentTask: null}, {patch: true});
    }
    unassignTask() {
        return this.currentTask().fetch()
        .then((task) => {
            return Promise.all([
                this.save({currentTask: null}, {patch: true}),
                task.save({volunteer_fbid: null, startTime: null, taskState: null}, {patch: true})
            ]);
        });
    }
    getMentorshipTask() {
        return new Task().query(qb => {
            qb.where("template_type", "=", "mentor")
            .andWhere("completed", "=", false)
            .andWhere(
                "instruction_params",
                "@>",
                JSON.stringify({mentee: {fbid: this.get("fbid")}})
            );
        })
        .fetch();
    }
    createMentorshipTask() {
        return this.currentTask().fetch().then(task => {
            if (!task) {
                throw new Error("There is no current task!");
            }
            const params = {
                mentee: this.serialize({shallow: true}),
                beacon: undefined
            };
            params.mentee.name = this.name();
            if (task.get("instructionParams").beacon) {
                params.beacon = task.get("instructionParams").beacon;
            } else {
                throw new Error("This task does not support mentorship yet.");
            }
            return new Task({
                templateType: "mentor",
                instructionParams: params,
                deploymentId: this.get("deploymentId"),
                estimatedTime: "15 min",
            })
            .save();
        });
    }
    sendMessage(message) {
        console.log("bot", bot);
        bot.sendMessage(this.get("fbid"), message);
    }
    name() {
        return `${this.get("firstName")} ${this.get("lastName")}`;
    }
}
// }, {
//     recoverStaleTasks: () => {
//         let cutoff = moment().subtract(6, "hours").format("YYYY-MM-DD HH:mm:ss");
//         return this.collection().query((qb) => {
//             qb.where(function() {
//                 this.where("last_messaged", "<", cutoff)
//                 .orWhere("last_response", "<", cutoff);
//             }).whereNotNull("current_task");
//         }).fetch()
//         .then(function(vols) {
//             return Promise.map(vols, function(vol) {
//                 .unassignTask()
//                 .then(function(vol) {
//                     return vol.sendMessage({text: "You didn't finish your task, so I have freed it up for others to take."});
//                 });
//             });
//         });
//     }
// });