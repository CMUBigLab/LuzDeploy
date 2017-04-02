let machina = require("machina");
import * as FBTypes from "facebook-sendapi-types";

import * as config from "../config";
import {bot} from "../bot";
import * as msgUtil from "../message-utils";
import {FingerprintPoint, Volunteer, Task} from"../models/";

function done(task: Task) {
    task.saveScore(15 + 5 * task.context.points.length)
    .then(() => {
        this.handle(task, "complete");
    });
}

export const FingerprintTaskFsm = machina.BehavioralFsm.extend({
    namespace: "fingerprint",
    initialState: "load_points",
    states: {
        load_points: {
            _onEnter: function(task: Task) {
                let self = this;
                FingerprintPoint.getPointsForSampling(
                    task.deploymentId,
                    3
                ).then(function(points) {
                    task.context = {
                        points: points.map((p: FingerprintPoint) => ({
                            floor: p.floor,
                            lat: p.latitude,
                            long: p.longitude
                        }))
                    };
                }).then(function() {
                    self.transition(task, "goto");
                });
            }
        },
        goto: {
            _onEnter: function(task: Task) {
                const text = "We need you to help us sample beacon data in the building. Please open the LuzDeploy app below and follow the instructions. Let me know when you are 'done'!";
                const locations = task.context.points.map(
                    p => `${p.floor},${p.lat},${p.long}`
                ).join(";");
                const url = `https://hulop.qolt.cs.cmu.edu/?type=datasampler&major=65535&locations=${locations}&wid=${task.volunteerFbid}&next=${config.THREAD_URI}&base=${config.BASE_URL}`
                const buttons = [
                    {
                        "type": "web_url",
                        "title": "Open LuzDeploy",
                        "url": url,
                        "webview_height_ratio": "compact",
                        "messenger_extensions": true,
                    }
                ] as Array<FBTypes.MessengerButton>;
                 bot.FBPlatform.sendButtonMessage(task.volunteerFbid.toString(), text, buttons);
            },
            "msg:done": done,
            "webhook:done": done
        },
    }
});

export const getNewTask = function(vol: Volunteer) {
    return null;
};