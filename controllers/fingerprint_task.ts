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
    initialState: "ios_check",
    states: {
        ios_check: {
            _onEnter: function(task: Task) {
                return task.assignedVolunteer().fetch()
                .then(vol => {
                    if (vol.hasIOS !== null) {
                        return this.transition(task, "download_app");
                    }
                    const text = "Some of our tasks require the use of a helper app to collect Bluetooth data. Do you have an iOS device?";
                    return vol.sendMessage(msgUtil.quickReplyMessage(text, ["yes", "no"]));
                });
            },
            "msg:yes": function(task: Task) {
                return new Volunteer({fbid: task.volunteerFbid}).save({"has_ios": true}, {patch: true})
                .then(() => this.transition(task, "download_app"));
            },
            "msg:no": function(task: Task) {
                return new Volunteer({fbid: task.volunteerFbid}).save({"has_ios": false}, {patch: true})
                .then(() => {
                    const text = "Unforuntately, we don't have the helper app available for other platforms yet. We will contact you when we do!";
                    return task.assignedVolunteer().fetch()
                    .tap(vol => vol.sendMessage(text))
                    .then(vol => vol.unassignTask());
                });
            }
        },
        download_app: {
            _onEnter: function(task: Task) {
                if (task.assignedVolunteer().appState !== "installed") {
                    return this.transition(task, "load_points");
                }
                const text = "You will need to download the app 'LuzDeploy Data Sampler'. Press the link below to open the App Store.";
                const url = "http://appstore.com/luzdeploydatasampler";
                const buttons = [{
                    "type": "web_url",
                    "title": "Download App",
                    "url": url,
                    "webview_height_ratio": "compact",
                }] as Array<FBTypes.MessengerButton>;
                return bot.FBPlatform.sendButtonMessage(
                    task.volunteerFbid.toString(),
                    text,
                    buttons
                ).then(() => bot.sendMessage(
                    task.volunteerFbid,
                    "Let me know when you are 'done'!")
                );
            },
            "msg:done": function(task: Task) {
                new Volunteer({fbid: task.volunteerFbid}).save({app_state: "installed"}, {patch: true})
                .then(() => this.transition(task, "load_points"));
            }
        },
        load_points: {
            _onEnter: function(task: Task) {
                let self = this;
                FingerprintPoint.getPointsForSampling(
                    task.deploymentId,
                    2
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
                const url = `${config.BASE_URL}/redirect.html?type=datasampler&major=65535&locations=${locations}&wid=${task.volunteerFbid}&next=${config.THREAD_URI}&base=${config.BASE_URL}`
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
    },
    getNewTask: function(vol: Volunteer) {
        if (vol.hasIOS === false) {
            return null;
        }
        return FingerprintPoint.getPointsForSampling(vol.deploymentId, 1)
        .then((points) => {
            if (points.length === 0) {
                return null;
            } else {
                return new Task({
                    template_type: "fingerprint",
                    deployment_id: vol.deploymentId
                });
            }
        });
    }
});