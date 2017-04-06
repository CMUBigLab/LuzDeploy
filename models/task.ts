import { BaseModel } from "./base";
import * as _ from "lodash";
import * as Promise from "bluebird";
import * as request from "request-promise";

import {bot} from "../bot";
import bookshelf = require("../bookshelf");
import {Deployment} from "./deployment";
import {Volunteer} from "./volunteer";
import { PGInterval, TaskTemplate } from "./task-template";

export class Task extends BaseModel<Task> {
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
  get type(): string { return this.get("template_type"); }
  get volunteerFbid(): number { return this.get("volunteer_fbid"); }
  get instructionParams(): any { return this.get("instruction_params"); }
  get startTime(): Date { return this.get("start_time"); }
  get completedTime(): Date { return this.get("completed_time"); }
  get deploymentId(): number { return this.get("deployment_id"); }
  get templateType(): string { return this.get("template_type"); }
  get score(): number { return this.get("score"); }
  get completed(): number { return this.get("completed"); }
  get taskState(): any { return this.get("task_state"); }
  get estimatedTime(): PGInterval { return this.get("estimated_time"); }

  start() {
      return this.save({start_time: new Date()}, {patch: true});
  }
  finish() {
    return this.save({completed: true, completed_time: new Date()}, {patch: true});
  }
  hasOutstandingDependancies() {
      return this.dependencies()
      .query({completed: false})
      .fetch()
      .then(d => (d.length > 0));
  }
  saveState() {
    let taskState = this.__machina__;
    if (this.context) {
      taskState.context = this.context;
    }
    return this.save({task_state: taskState}, {patch: true});
  }
  loadState() {
    let state = this.taskState;
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
      const int = _.defaults(this.estimatedTime, {hours: 0, minutes: 0, seconds: 0});
      return int.hours * 60 + int.minutes + int.seconds / 60;
    }
  estimatedTimeSec() {
      return this.estimatedTimeMin() * 60;
    }
  timeTakenSec() {
      return (this.completedTime.getTime() - this.startTime.getTime()) / 1000;
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
    // TODO: generalize message
    text = text || `Hi ${vol.firstName}, could you help me with this today in Gates?`;
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