import {scheduleJob, RecurrenceRule, Range} from "node-schedule";
import * as moment from "moment";
import * as Promise from "bluebird";
import * as logger from "winston";

import {bot} from "./bot";
import {Volunteer} from "./models/volunteer";
import {Task} from "./models/task";
import { Deployment } from "./models/deployment";
import { DATE_FORMAT } from "./config";

const DEPLOYMENT_ID = 2; // TODO: should not hardcode this, should be set on table?

const weekdays10AM = new RecurrenceRule();
weekdays10AM.dayOfWeek = [new Range(1, 5)]; // Monday through Friday
weekdays10AM.hour = 10; // 10 AM
weekdays10AM.minute = 0; // 0 minutes after 10 AM

const everyMinute = new RecurrenceRule();

// Remind volunteers that there are more tasks available.
export function remindVolunteersOfTasksAvailable() {
    logger.info("running remind volunteers of tasks job");
    const twelveHoursAgo = moment().subtract(12, "hours");
    const getVolunteers = Volunteer.where<Volunteer>("current_task", null)
    .where("deployment_id", DEPLOYMENT_ID)
    .where("last_messaged", "<", twelveHoursAgo.format(DATE_FORMAT))
    .where("last_responed", "<", twelveHoursAgo.format(DATE_FORMAT))
    .fetchAll();

    const getTaskCount = Task.where<Task>({
        completed: false,
        assignedVolunteer: null,
        deploymentId: DEPLOYMENT_ID
    }).count();

    Promise.join(getVolunteers, getTaskCount, (volunteers, taskCount) => {
        if (taskCount > 0) {
            return Promise.all(volunteers.map((volunteer) => {
                const text = "Good morning! I have some tasks to do today. If you have time, please 'ask' me for one!";
                const quickReply = bot.FBPlatform.createQuickReply("ask", "ask");
                return bot.FBPlatform.sendQuickReplies(volunteer.get("fbid"), text, [quickReply]);
            }));
        }
    }).then(() => logger.info("Finished reminding volunteers of tasks"));
}

export function setupJobs() {
    scheduleJob(everyMinute, remindVolunteersOfTasksAvailable);
    //scheduleJob(weekdays10AM, remindVolunteersOfTasksAvailable);
}
