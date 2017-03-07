import * as moment from "moment-timezone";
import * as logger from "winston";

import { TIME_ZONE } from "../config";
import {remindVolunteersOfTasksAvailable} from "./remind_new_tasks";

import * as express from "express";
export const router = express.Router();

moment.locale("en");

const jobSchedule = [{
    name: "remind users of new tasks",
    function: remindVolunteersOfTasksAvailable,
    weekdays: [1, 2, 3, 4, 5],
    startTime: "12:29",
    endTime: "12:35",
}];

router.post("/remind", (req, res, next) => {
    remindVolunteersOfTasksAvailable()
    .then(() => logger.info(`Finished running reminder job`))
    .then(() => res.send("OK"))
    .catch((err) => {
        logger.error(err);
        res.sendStatus(500);
    });
});

const now = moment().tz(TIME_ZONE);
const timeFormat = "HH:mm";
for (let job of jobSchedule) {
    const startTime = moment.tz(job.startTime, timeFormat, TIME_ZONE);
    const endTime = moment.tz(job.endTime, timeFormat, TIME_ZONE);
    const correctTime = now.isBetween(startTime, endTime);
    const correctDay = job.weekdays.includes(now.weekday());
    if (!correctDay) {
        logger.info(`not correct day (${now.weekday()}) to run job: ${job.name}`);
        continue;
    }
    if (!correctTime) {
        logger.info(`not correct time (${now.format(timeFormat)}) to run job: ${job.name}`);
        continue;
    }

    logger.info(`running scheduled job: ${job.name}`);
    job.function()
    .then(() => logger.info(`Finished job: ${job.name}`))
    .catch((err) => logger.error(err));
}