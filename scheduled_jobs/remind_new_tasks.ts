import * as Promise from "bluebird";
import * as moment from "moment";

import {DATE_FORMAT} from "../config";
import {bot} from "../bot";
import {Volunteer} from "../models/volunteer";
import {Task} from "../models/task";
import { Deployment } from "../models/deployment";

import { taskControllers } from "../controllers/task";

const DEPLOYMENT_ID = 2; // TODO: should not hardcode this, should be set on table?

// Remind volunteers that there are more tasks available.
export function remindVolunteersOfTasksAvailable(): Promise<any> {
    const twelveHoursAgo = moment().subtract(12, "hours");
    const getVolunteers = Volunteer.where<Volunteer>("current_task", null)
    .where("deployment_id", DEPLOYMENT_ID)
    .where("last_messaged", "<", twelveHoursAgo.format(DATE_FORMAT))
    .where("last_response", "<", twelveHoursAgo.format(DATE_FORMAT))
    .fetchAll();

    const getTaskPool = new Deployment({id: DEPLOYMENT_ID}).fetch()
    .then((deployment) => deployment.getTaskPool());

    return Promise.join(getVolunteers, getTaskPool, (volunteers, tasks) => {
        return Promise.mapSeries(volunteers.map<Volunteer>(), (volunteer) => {
            if (tasks.length > 0) {
                const task = tasks.pop();
                const controller = taskControllers[task.type];
                return controller.assign(task, volunteer)
                .then(() => task.getProposalMessage(volunteer))
                .then(message => message.send());
            }
        });
    });
}


