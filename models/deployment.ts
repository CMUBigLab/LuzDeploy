import * as _ from "lodash";
import * as Promise from "bluebird";

import * as msgUtil from "../message-utils";
import bookshelf = require("../bookshelf");
import {Volunteer} from "./volunteer";
import {Task} from "./task";

export class Deployment extends bookshelf.Model<Deployment> {
    get tableName() { return "deployments"; }
    volunteers() {
        return this.hasMany(Volunteer);
    }

    tasks() {
        return this.hasMany(Task);
    }

    distributeTasks() {
        return this.volunteers()
        .query({where: {currentTask: null}})
        .fetch()
        .then(volunteers => {
            volunteers.forEach((v) => (v as Volunteer).getNewTask());
        });
    }

    getTaskPool() {
        return this.tasks()
        .query({where: {completed: false, volunteer_fbid: null, disabled: false}})
        .fetch()
        .then(function(pool) {
            return pool.sortBy(function(task) {
                return [task.get("templateType"), Number(task.get("instructionParams").edge)];
            });
        });
    }

    doesAnyoneNeedHelp(mentor) {
        return this.tasks()
        .query(function(qb) {
            qb.where({
                template_type: "mentor",
                volunteer_fbid: null,
                completed: false
            })
            .andWhereNot(
                "instruction_params",
                "@>",
                JSON.stringify({mentee: {fbid: mentor.get("fbid")}})
            );
        }).fetchOne();
    }

    checkThresholds() {
        return this.volunteers().fetch({withRelated: ["currentTask"]})
        .then(function(volunteers) {
            volunteers.forEach((v: Volunteer) => {
                if (v.get("currentTask") && v.get("startTime") && !v.get("completed")) {
                    if (v.currentTask().timeScore() < 0 && v.currentTask().timeScore() > -1) {
                        let text = "You didn't finish your task in the estimated thim period. Do you need help?";
                        let buttons = [{type: "postback", title: "Yes, please send someone.", payload: "{\"type\":\"send_mentor\",\"args\":{}}"}];
                        v.sendMessage(msgUtil.buttonMessage(text, buttons));
                    } else if (v.currentTask().timeScore() < -1) {
                        v.sendMessage({text: "You haven't finished your task in more that twice the estimated time it would take. We are going to send someone to help you."});
                        return v.createMentorshipTask();
                    }
                }
            });
        });
    }

    start() {
        return this.save({startTime: new Date(), active: true});
    }

    sendSurvey(vol) {
        let buttons = [{
            type: "web_url",
            url: `https://docs.google.com/forms/d/e/1FAIpQLSfkJZb1GOGR1HfC8zw2nipkl3yi_-7cDbUNvigl2PjqLxhbqw/viewform?entry.2036103825=${vol.get("fbid")}`,
            title: "Open Survey"
        }];
        let text = "I am work-in-progress, so please help me become a better bot by answering this quick survey!";
        return vol.sendMessage(msgUtil.buttonMessage(text, buttons));
    }

    finish() {
        return this.volunteers().fetch().then(volunteers => {
            // volunteers.forEach((v) => {
            // 	v.sendMessage({text: "Thank you very much!\nYou just helped make CMU accessible."})
            // 	this.sendSurvey(v)
            // })
            return this.save({doneTime: new Date()});
        });
    }

    isComplete() {
        return this.tasks()
        .query({where: {completed: false}}).count()
        .then(count => false); // (count == 0))
    }

    isCasual() {
        const type = this.get("type");
        return type === "casual" || type === "semiCasual";
    }
}