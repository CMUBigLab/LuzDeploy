import * as moment from "moment-timezone";

import { TIME_ZONE } from "../config";
import {remindVolunteersOfTasksAvailable} from "./remind_new_tasks";

const jobSchedule = [{
    function: remindVolunteersOfTasksAvailable,
    weekdays: [1, 2, 3, 4, 5],
    startTime: "09:00",
    endTime: "10:00",
}];

const now = moment().tz(TIME_ZONE);
const timeFormat = "hh:mm";
for (let job of jobSchedule) {
    const startTime = moment(job.startTime, timeFormat);
    const endTime = moment(job.endTime, timeFormat);
    const correctTime = now.isBetween(startTime, endTime);
    const correctDay = job.weekdays.includes(now.weekday());
    if (correctDay && correctTime) {
        job.function();
    }
}