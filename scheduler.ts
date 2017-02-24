import {scheduleJob} from "node-schedule";

const Task = require("./models/task");

scheduleJob({hour: 1}, Task.recoverStaleTasks());