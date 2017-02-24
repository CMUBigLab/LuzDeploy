let machina = require("machina");

import * as config from "../config";
import {bot} from "../app";
import * as msgUtil from "../message-utils";

export const SweepTaskFsm = machina.BehavioralFsm.extend({
    namespace: "sweep_edge",
    initialState: "goto",
    states: {
        goto: {
            _onEnter: function(task) {
                let text = "We need you to help us check which beacons are not working in the building. Please open the LuzDeploy app below and follow the instructions. Let me know when you are 'done'!";
                let params = task.get("instructionParams");
                // TODO: fix
                // "webview_height_ratio": "compact",
                // "messenger_extensions": true,
                const url = `https://hulop.qolt.cs.cmu.edu/?type=beaconsweeper&major=65535&edge=${params.edge}&beaconlist=${params.beacons}&wid=${task.get("volunteer_fbid")}&start=${params.start}&end=${params.end}&next=${config.THREAD_URI}&base=${config.BASE_URL}`;
                bot.FBPlatform.createButtonMessage(task.get("volunteer_fbid"))
                .text(text)
                .webButton("Open LuzDeploy", url)
                .send();
            },
            "msg:done": function(task) {
                this.handle(task, "complete");
            },
            "webhook:done": function(task) {
                this.handle(task, "complete");
            }
        },
    }
});