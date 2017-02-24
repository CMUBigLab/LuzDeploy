import * as _ from "lodash";
import * as Promise from "bluebird";
import * as dust from "dustjs-linkedin";

import bookshelf = require("../bookshelf");
import {Deployment} from "./deployment";

export class TaskTemplate extends bookshelf.Model<TaskTemplate> {
  get tableName() { return "task_templates"; }
  get idAttribute() {return "type"; }

  deployment() {
    return this.belongsTo(Deployment);
  }

  renderInstructions(context) {
    const promises = this.get("instructions").map((i) => {
        return new Promise((resolve, reject) => {
          dust.renderSource(JSON.stringify(i.message), context, (err, out) => {
            if (err) return reject(err);
            i.message = JSON.parse(out);
              return resolve(i);
          });
        });
    });
    return Promise.all(promises);
  }

}