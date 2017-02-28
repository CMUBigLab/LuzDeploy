import * as Promise from "bluebird";
import * as moment from "moment";

import {DATE_FORMAT} from "../config";
import {bot} from "../bot";
import {Volunteer} from "../models/volunteer";
import {Task} from "../models/task";
import { Deployment } from "../models/deployment";

const DEPLOYMENT_ID = 3; // TODO: should not hardcode this, should be set on table?

// Remind volunteers that there are more tasks available.
export function remindVolunteersOfTasksAvailable(): Promise<any> {
    const twelveHoursAgo = moment().subtract(12, "hours");
    const getVolunteers = Volunteer.where<Volunteer>("current_task", null)
    .where("deployment_id", DEPLOYMENT_ID)
    .where("last_messaged", "<", twelveHoursAgo.format(DATE_FORMAT))
    .where("last_response", "<", twelveHoursAgo.format(DATE_FORMAT))
    .fetchAll();

    const getTaskCount = Task.where<Task>({
        completed: false,
        volunteer_fbid: null,
        deployment_id: DEPLOYMENT_ID
    }).count();

    return Promise.join(getVolunteers, getTaskCount, (volunteers, taskCount) => {
        if (taskCount > 0) {
            return Promise.all(volunteers.map((volunteer) => {
                const text = "Good morning! I have some tasks to do today. If you have time, please 'ask' me for one!";
                const quickReply = bot.FBPlatform.createQuickReply("ask", "ask");
                return bot.FBPlatform.sendQuickReplies(volunteer.get("fbid"), text, [quickReply]);
            }));
        }
    });
}


