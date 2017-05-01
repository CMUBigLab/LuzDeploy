let machina = require("machina");
import * as FBTypes from "facebook-sendapi-types";

import * as config from "../config";
import {bot} from "../bot";
import * as msgUtil from "../message-utils";
import { Task, Volunteer, Beacon, BeaconSlot } from "../models";
import * as Promise from "bluebird";
import * as moment from "moment";
import * as _ from "lodash";
import {getAndAssignVolTask} from "../handlers";

export const SweepTaskFsm = machina.BehavioralFsm.extend({
    namespace: "sweep_edge",
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
                return task.assignedVolunteer().fetch()
                .then((vol: Volunteer) => vol.save({"has_ios": true}))
                .then(() => this.transition(task, "download_app"));
            },
            "msg:no": function(task: Task) {
                return task.assignedVolunteer().fetch()
                .then((vol: Volunteer) => vol.save({"has_ios": false}))
                .then((vol: Volunteer) => {
                    const text = "Unforuntately, we don't have the helper app available for other platforms yet. We will contact you when we do!";
                    return vol.sendMessage({text})
                    .then(() => vol.unassignTask());
                }).then(([vol, oldTask]) => getAndAssignVolTask(vol));
            },
        },
        download_app: {
            _onEnter: function(task: Task) {
                return task.assignedVolunteer().fetch()
                .then(vol => {
                    if (vol.appState === "installed") {
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
                        vol.fbid.toString(),
                        text,
                        buttons
                    ).then(() => {
                        const text = "Then come back to this conversation and let me know when you are 'done'!";
                        return vol.sendMessage(msgUtil.quickReplyMessage(text, ["done"]));
                    }); 
                });
            },
            "msg:done": function(task: Task) {
                return task.assignedVolunteer().fetch()
                .then((vol: Volunteer) => vol.save({app_state: "installed"}))
                .then(() => this.transition(task, "goto"));
            }
        },
        goto: {
            _onEnter: function(task: Task) {
                const text = "We need you to help us check which beacons are not working in the building. Please open the LuzDeploy app below and follow the instructions. Let me know when you are 'done'!";
                const params = task.instructionParams;
                const url = `https://hulop.qolt.cs.cmu.edu/?type=beaconsweeper&major=65535&edge=${params.edge}&beaconlist=${params.beacons}&wid=${task.volunteerFbid}&start=${params.start}&end=${params.end}&next=${config.THREAD_URI}&base=${config.BASE_URL}`;
                const buttons = [{
                    type: "web_url",
                    title: "Open LuzDeploy",
                    url: url,
                    webview_height_ratio: "compact",
                    messenger_extensions: true,
                }] as Array<FBTypes.MessengerButton>;
                bot.FBPlatform.sendButtonMessage(task.volunteerFbid.toString(), text, buttons);
            },
            "msg:done": function(task: Task) {
                task.saveScore(40).then(() => this.handle(task, "complete"));
            },
            "webhook:done": function(task) {
                task.saveScore(40).then(() => this.handle(task, "complete"));
            }
        },
    },
    getNewTask: function(vol: Volunteer): Promise<Task> {
        if (vol.hasIOS === false) {
            return null;
        }
        return Beacon.collection<Beacon>()
        .query(qb => {
            qb.where({deployment_id: vol.deploymentId})
            .whereNotNull("slot");
        }).fetch({withRelated: "slot"})
        .then(beacons => beacons.groupBy(
            (b: Beacon) => (b.related<BeaconSlot>("slot") as BeaconSlot).edge)
        ).then(edges => {
            const minDate = (bs: Beacon[]) => _.min(bs.map(b => b.lastSwept)) || null;
            const edge = _.keys(edges).reduce(
                (a, b, i) => minDate(edges[a]) < minDate(edges[b]) ? a : b
            );

            const beacons = edges[edge];
            const lastSwept = minDate(beacons);
            if (lastSwept === null || moment(lastSwept).isBefore(moment().subtract(4, "weeks"))) {
                const slot = beacons[0].related<BeaconSlot>("slot") as BeaconSlot;
                console.log("slot debug", beacons[0], slot);
                return new Task({
                    type: "sweep_edge",
                    instruction_params: {
                        edge: edge,
                        start: slot.startNode,
                        end: slot.endNode,
                        beacons: beacons.map(b => b.minorId)
                    }
                });
            }
        });
    }
});