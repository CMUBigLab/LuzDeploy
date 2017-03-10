import * as _ from "lodash";
import * as Promise from "bluebird";
import * as request from "request-promise";

import {bot} from "../bot";
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

  // columns
  get type(): string { return this.get("templateType"); }
  get volunteerFbid(): number { return this.get("volunteerFbid"); }
  get instructionParams(): any { return this.get("instructionParams"); }

  start() {
      return this.save({startTime: new Date()}, {patch: true});
  }
  finish() {
    return this.save({completed: true, completedTime: new Date()}, {patch: true});
  }
  hasOutstandingDependancies() {
      return this.dependencies()
      .query({"completed": false})
      .fetch()
      .then(d => (d.length > 0));
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

  saveScore(score: number) {
    return this.save({score}, {patch: true});
  }
  getTaskDetailText() {
    return this.template().fetch()
    .then((template: TaskTemplate) => {
      return `Task: ${template.title}
Details: ${template.description}
Estimated Time: ${template.estimatedTimeMin} minutes`;
    });
  }
  getProposalMessage(vol: Volunteer, text = null) {
    text = text || `Hi ${vol.firstName}, could you help me with this today?`;
    return this.getTaskDetailText()
    .then((details: string) => {
      return bot.FBPlatform.createButtonMessage(vol.fbid)
      .text(`${text}
${details}`)
      .postbackButton("Start Task", JSON.stringify({type: "start_task", args: null}))
      .postbackButton("Reject Task", JSON.stringify({type: "reject_task", args: null}));
    });
  }
}