let machina = require("machina");

import * as config from "../config";
import {bot} from "../bot";
import * as msgUtil from "../message-utils";
import {FingerprintPoint} from"../models/fingerprint-point";

export const FingerprintTaskFsm = machina.BehavioralFsm.extend({
    namespace: "fingerprint",
    initialState: "load_points",
    states: {
        load_points: {
            _onEnter: function(task) {
                let self = this;
                FingerprintPoint.getPointsForSampling(
                    task.get("deployment_id"),
                    3
                ).then(function(points) {
                    task.context = {
                        points: points.map(p => ({
                            floor: p.get("floor"),
                            lat: p.get("lat"),
                            long: p.get("long")
                        }))
                    };
                }).then(function() {
                    self.transition(task, "goto");
                });
            }
        },
        goto: {
            _onEnter: function(task) {
                let text = "We need you to help us sample beacon data in the building. Please open the LuzDeploy app below and follow the instructions. Let me know when you are 'done'!";
                let locations = task.context.points.map(p => `${p.floor},${p.lat},${p.long}`).join(";");

                 //  "webview_height_ratio": "compact",
                 //    "messenger_extensions": true,
                 const url = `https://hulop.qolt.cs.cmu.edu/?type=datasampler&major=65535&locations=${locations}&wid=${task.get("volunteer_fbid")}&next=${config.THREAD_URI}&base=${config.BASE_URL}`
                 bot.FBPlatform.createButtonMessage(task.get("volunteer_fbid"))
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