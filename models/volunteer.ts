import { getTaskPool } from "../controllers/task";
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
    get fbid(): string { return this.id; }
    get firstName(): string { return this.get("first_name"); }
    get lastName(): string { return this.get("last_name"); }
    get username(): string { return this.get("username"); }
    get lastMessaged(): Date { return this.get("last_messaged"); }
    get lastResponse(): Date { return this.get("last_response"); }
    get deploymentId(): number { return this.get("deployment_id"); }
    get ignoring(): boolean { return this.get("ignoring"); }
    get hasIOS(): boolean { return this.get("has_ios"); }
    get appState(): string { return this.get("app_state"); }

    assignTask(task: Task) {
        return Promise.join(
            this.save({current_task: task.id}, {patch: true}),
            task.save({volunteer_fbid: this.id}, {patch: true}),
            (vol: Volunteer, task: Task) => { return task; });
    }
    getNewTask() {
        return getTaskPool(this)
        .then(pool => {
            return (pool.length > 0) ? _.sample(pool) : null;
        });
    }
    getAverageExpertise() {
        return Task.collection()
        .query({
            volunteer_fbid: this.id,
            completed: true
        })
        .query("where", "score", "is not", null)
        .fetch()
        .then(tasks => {
            const total = _.sum(tasks.map((t: Task) => t.score));
            return tasks.length ? total / tasks.length : 0;
        });
    }
    getAverageTime() {
        return Task.collection()
        .query({
            volunteer_fbid: this.id,
            completed: true
        }).query("where", "completed_time", "is not", null)
        .query("where", "start_time", "is not", null)
        .fetch()
        .then(tasks => {
            const total = _.sum(tasks.map((t: Task) => t.timeScore));
            return tasks.length ? total / tasks.length : 0;
        });
    }
    completeTask() {
        return this.save({current_task: null}, {patch: true});
    }
    unassignTask(): Promise<[Volunteer, Task]> {
        console.log(this);
        return this.currentTask().fetch()
        .then((task: Task) => {
            return Promise.all([
                this.save({current_task: null}, {patch: true}),
                task.save({volunteer_fbid: null, start_time: null, task_state: null}, {patch: true})
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
                JSON.stringify({mentee: {fbid: this.id}})
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
            if (task.instructionParams.beacon) {
                params.beacon = task.instructionParams.beacon;
            } else {
                throw new Error("This task does not support mentorship yet.");
            }
            return new Task({
                templateType: "mentor",
                instructionParams: params,
                deploymentId: this.deploymentId,
                estimatedTime: "15 min",
            })
            .save();
        });
    }
    sendMessage(message) {
        return bot.sendMessage(this.id, message);
    }

    name() {
        return `${this.firstName} ${this.lastName}`;
    }
}