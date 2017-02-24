import * as _ from "lodash";
import * as Promise from "bluebird";
import * as request from "request-promise";

import {bot} from "../app";
import bookshelf = require("../bookshelf");
import {Deployment} from "./deployment";
import {Volunteer} from "./volunteer";
import {TaskTemplate} from "./task-template";

export class Task extends bookshelf.Model<Task> {
  public context: any;
  public __machina__: any;

  get tableName() { return "tasks"; }
  deployment() {
    return this.belongsTo(Deployment);
  }
  assignedVolunteer() {
    return this.belongsTo(Volunteer, "volunteer_fbid");
  }
  dependencies() {
    return this.belongsToMany(Task, "dependencies", "parent", "child");
  }
  differentVolunteerSet() {
    return this.belongsToMany(Task, "different_volunteer_tasks", "task1_id", "task2_id");
  }
  template() {
    return this.belongsTo(TaskTemplate, "template_type");
  }
  //allowedToTake(vol) {
  //  return this.related("differentVolunteerSet").where({volunteerFbid: vol.get("fbid")}).length === 0
  //}
  start() {
      return this.save({startTime: new Date()}, {patch: true});
      // TODO: extract following code into specific task controller
/*      .tap(task => {
        if (task.get('templateType') == 'mentor') {
          bot.sendMessage(
            task.get('instructionParams').mentee.fbid,
            {text: `You asked for help, so ${task.assignedVolunteer().name} is coming to help you at your task location.`}
          )
        }
      })*/
  }
  finish() {
    return this.save({completed: true, completedTime: new Date()}, {patch: true});
// TODO: extract into task controller
/*        const webhook = this.get('completedWebhook')
        if (webhook) {
          return request.post({url: webhook, data: task.serialize({shallow: true})})
          .then((parsedBody) => {
            return Promise.resolve(task.set('score', parsedBody.score))
          }).catch((err) => {
            console.error(err)
          })
        }*/
  }
  renderInstructions(otherParams) {
    return this.load(["template"]).then((task) => {
      let params = this.get("instructionParams");
      params = _.assign(params, otherParams);
      return (task.related("template") as TaskTemplate).renderInstructions(params);
    });
  }
  hasOutstandingDependancies() {
      return this.dependencies()
      .query({"completed": false})
      .fetch()
      .then(d => (d.length > 0));
  }
  getPlaceTask() {
    const Task = bookshelf.model("Task");
    return new Task({
      deploymentId: this.get("deploymentId"),
      templateType: "place_beacon",
    }).query((qb) => {
      qb.where("instruction_params", "=", this.get("instructionParams"));
    }).fetch();
  }
  saveState() {
    let taskState = this.__machina__;
    if (this.context) {
      taskState.context = this.context;
    }
    return this.save({taskState}, {patch: true});
  }
  loadState() {
    let state = this.get("taskState");
    if (!state) {
      return;
    }
    if (state.context) {
      this.context = state.context;
      delete state.context;
    }
    this.__machina__ = state;
  }
    estimatedTimeMin() {
      const int = _.defaults(this.get("estimatedTime"), {hours: 0, minutes: 0, seconds: 0});
      return int.hours * 60 + int.minutes + int.seconds / 60;
    }
    estimatedTimeSec() {
      return this.estimatedTimeMin() * 60;
    }
    timeTakenSec() {
      return (this.get("completedTime").getTime() - this.get("startTime").getTime()) / 1000;
    }
    timeScore() {
      return (this.estimatedTimeSec() - this.timeTakenSec()) / this.estimatedTimeSec();
    }
}

export class DifferentVolunteerTasks extends bookshelf.Model<DifferentVolunteerTasks> {
  get tableName() { return "different_volunteer_tasks"; }
  task1() {
    return this.belongsTo(Task, "task1_id");
  }
  task2() {
    return this.belongsTo(Task, "task2_id");
  }
}