import * as Promise from "bluebird";
import * as moment from "moment";

import {DATE_FORMAT} from "../config";
import {bot} from "../bot";
import {Volunteer} from "../models/volunteer";
import {Task} from "../models/task";
import { Deployment } from "../models/deployment";

import { TaskFsm } from "../controllers/task";

const DEPLOYMENT_ID = 2; // TODO: should not hardcode this, should be set on table?

// Remind volunteers that there are more tasks available.
export function remindVolunteersOfTasksAvailable(): Promise<any> {
    const twelveHoursAgo = moment().subtract(12, "hours");
    const getVolunteers = Volunteer.collection().query((qb) => {
        qb.whereNull("current_task")
        .where("deployment_id", DEPLOYMENT_ID)
        .where((qb) => {
            qb.where("last_response", "<", twelveHoursAgo.format(DATE_FORMAT))
            .orWhereNull("last_response");
        }).where((qb) => {
            qb.where("last_messaged", "<", twelveHoursAgo.format(DATE_FORMAT))
            .orWhereNull("last_messaged");
        })
    }).fetch();

    const getTaskPool = new Deployment({id: DEPLOYMENT_ID}).fetch()
    .then((deployment) => deployment.getTaskPool());

    return Promise.join(getVolunteers, getTaskPool, (volunteers, tasks) => {
        return Promise.mapSeries(volunteers.map<Volunteer>(), (volunteer) => {
            if (tasks.length > 0) {
                const task = tasks.pop();
                return TaskFsm.assign(task, volunteer)
                .then(() => task.getProposalMessage(volunteer))
                .then(message => message.send());
            }
        });
    });
}


