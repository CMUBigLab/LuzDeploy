let machina = require("machina");
import * as FBTypes from "facebook-sendapi-types";

import * as config from "../config";
import {bot} from "../bot";
import * as msgUtil from "../message-utils";
import { Task } from "../models/task";

export const SweepTaskFsm = machina.BehavioralFsm.extend({
    namespace: "sweep_edge",
    initialState: "goto",
    states: {
        goto: {
            _onEnter: function(task) {
                const text = "We need you to help us check which beacons are not working in the building. Please open the LuzDeploy app below and follow the instructions. Let me know when you are 'done'!";
                const params = task.get("instructionParams");
                const url = `https://hulop.qolt.cs.cmu.edu/?type=beaconsweeper&major=65535&edge=${params.edge}&beaconlist=${params.beacons}&wid=${task.get("volunteer_fbid")}&start=${params.start}&end=${params.end}&next=${config.THREAD_URI}&base=${config.BASE_URL}`;
                const buttons = [{
                    type: "web_url",
                    title: "Open LuzDeploy",
                    url: url,
                    webview_height_ratio: "compact",
                    messenger_extensions: true,
                }] as Array<FBTypes.MessengerButton>;
                bot.FBPlatform.sendButtonMessage(task.get("volunteerFbid"), text, buttons);
            },
            "msg:done": function(task: Task) {
                task.saveScore(40).then(() => this.handle(task, "complete"));
            },
            "webhook:done": function(task) {
                task.saveScore(40).then(() => this.handle(task, "complete"));
            }
        },
    }
});