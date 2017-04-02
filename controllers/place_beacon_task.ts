let machina = require("machina");
import * as Promise from "bluebird";
import * as FBTypes from "facebook-sendapi-types";

import * as config from "../config";
import {bot} from "../bot";
import * as msgUtil from "../message-utils";

import { Beacon, BeaconSlot, Deployment, Task, Volunteer } from "../models";

export const PlaceBeaconsTaskFsm = machina.BehavioralFsm.extend({
    namespace: "place_beacons",
    initialState: "supply",
    beaconToReturn: function(task) {
        task.context.toReturn.push(task.context.currentBeaconNumber);
        task.context.currentBeacon = null;
        task.context.numBeacons--;
        task.context.slots.pop(1);
        if (task.context.numBeacons === 0) {
            this.transition(task, "return");
            return;
        } else {
            return bot.sendMessage(
                task.volunteerFbid,
                {text: "Later, please return that beacon to the supply station. For now we will plave another beacon."}
            ).then(() => this.transition(task, "which"));
        }
    },
    states: {
        supply: {
            _onEnter: function(task: Task) {
                return task.deployment().fetch()
                .then((deployment: Deployment) => {
                    let text = `In this task you will place beacons in the environment that will be used by people with visual impairments to navigate. Please go to the Supply Station (${deployment.supplyStation}). Tell me when you are 'there'.`;
                    return bot.sendMessage(
                        task.volunteerFbid,
                        msgUtil.quickReplyMessage(text, ["there"])
                    );
                });
            },
            "msg:there": "pickup",
        },
        pickup: {
            _onEnter: function(task) {
                return task.deployment().fetch()
                .then((deployment: Deployment) => {
                    let text = `Great! ${deployment.supplyStationInstructions} Tell me how many you took (you can press a button or type a number).`;
                    return bot.sendMessage(
                        task.volunteerFbid,
                        msgUtil.quickReplyMessage(text, ["1", "3", "5", "10"])
                    );
                });
            },
            number: function(task: Task, n) {
                task.context = {
                    initialBeacons: n,
                    numBeacons: n,
                    currentSlot: null,
                    currentBeacon: null,
                    toReturn: [],
                    score: 30 + n * 10
                };
                let self = this;
                BeaconSlot.getNSlots(n, task.deploymentId)
                .then((slots) => {
                    if (slots.length === 0) {
                        task.context.numBeacons = 0;
                        let text = `I could not find any place that needs beacons. Please return all beacons.`;
                        return bot.sendMessage(task.volunteerFbid, {text: text})
                        .then(() => this.handle(task , "reject"))
                    } else if (slots.length !== n) {
                        // TODO: handle case when slots.length == 0
                        task.context.numBeacons = slots.length;
                        let text = `I could only find ${slots.length} places needing beacons. Please return any excess beacons.`;
                        return bot.sendMessage(task.volunteerFbid, {text: text})
                        .then(() => self.transition(task, "go"));
                    }
                    task.context.slots = slots.map(s => s.id);
                    return slots.invokeThen("save", {in_progress: true})
                    .then(() => self.transition(task, "go"));
                });
            },
        },
        go: {
            _onEnter: function(task) {
                task.context.currentSlot = task.context.slots.pop(1);
                return task.deployment().fetch()
                .then((deployment: Deployment) => {
                    const url = `${config.BASE_URL}/map/?advanced&hidden&map=${deployment.mapFilename}&beacon=${task.context.currentSlot}`
                    const text = `You have ${task.context.numBeacons} beacons to place. Please go to the location marked on the map below.`;
                    const buttons = [
                        {
                            "type": "web_url",
                            "title": "Open Map",
                            "url": url,
                            "webview_height_ratio": "tall",
                            "messenger_extensions": true,
                        }
                    ] as Array<FBTypes.MessengerButton>;
                    return bot.FBPlatform.sendButtonMessage(task.volunteerFbid, text, buttons)
                }).then(() => {
                    return bot.sendMessage(
                        task.volunteerFbid,
                        msgUtil.quickReplyMessage("Tell me when you are 'there'!", ["there"])
                    );
                });
            },
            "msg:there": "confirm_empty",
        },
        confirm_empty: {
            _onEnter: function(task) {
                const text = "Is there already a beacon placed on the wall there?";
                return bot.sendMessage(
                    task.volunteerFbid,
                    msgUtil.quickReplyMessage(text, ["no", "yes"])
                );
            },
            "msg:yes": function(task: Task) {
                let self = this;
                new BeaconSlot({id: task.context.currentSlot})
                .save({status: "occupied"}, {patch: true})
                .then((slot) => {
                    return BeaconSlot.getNSlots(1, task.deploymentId);
                }).then((slots) => {
                    if (slots.length === 0) {
                        task.context.numBeacons -= 1;
                        let text = "I couldn't find any other spots that need beacons. Please return any excess beacons later.";
                        return bot.sendMessage(task.volunteerFbid, {text});
                    } else {
                        let slot: BeaconSlot = slots.first() as BeaconSlot;
                        task.context.toReturn.push(-1);
                        task.context.slots.push(slot.id);
                        let text = "Ok, I'll find you a new spot to put the beacon.";
                        return bot.sendMessage(task.volunteerFbid, {text})
                        .then(() => {
                            return slot.save({in_progress: true});
                        });
                    }
                }).then(function(slot) {
                    self.transition(task, "go");
                });
            },
            "msg:no": function(task) {
                this.transition(task, "which");
            }
        },
        which: {
            _onEnter: function(task) {
                return bot.sendMessage(
                    task.volunteerFbid,
                    {text: `What is the number on the back of one of the beacons you have?`}
                );
            },
            number: function(task, id) {
                task.context.currentBeaconNumber = id;
                this.transition(task, "confirm_which");
            }
        },
        confirm_which: {
            _onEnter: function(task) {
                let text = `The beacon number is ${task.context.currentBeaconNumber}, correct?`;
                return bot.sendMessage(
                    task.volunteerFbid,
                    msgUtil.quickReplyMessage(text, ["yes", "no"])
                );
            },
            "msg:yes": function(task: Task) {
                let self = this;
                new Beacon({id: task.context.currentBeaconNumber, deployment_id: task.deploymentId})
                .fetch({require: true, withRelated: ["slot"]})
                .then(function(beacon: Beacon) {
                    if (beacon.related("slot") == null) {
                        task.context.currentBeacon = beacon.id;
                        self.transition(task, "place");
                    } else {
                        return bot.sendMessage(
                            task.volunteerFbid,
                            {text: "Hm, that beacon number is already used elsewhere. We won't use that one."}
                        ).then(() => {
                            return self.beaconToReturn(task);
                        });
                    }
                })
                .catch(Beacon.NotFoundError, function() {
                    return bot.sendMessage(
                        task.volunteerFbid,
                        {text: "Hm, I can't find a record for that beacon. We won't use that one."}
                    ).then(() => {
                        return self.beaconToReturn(task);
                    });
                });
            },
            "msg:no": function(task) {
                this.transition(task, "which");
            }
        },
        place: {
            _onEnter: function(task) {
                return task.deployment().fetch()
                .then((deployment: Deployment) => {
                    const url = `${config.BASE_URL}/map/?advanced&hidden&map=${deployment.mapFilename}&beacon=${task.context.currentSlot}`;
                    const text = "Place the beacon high on the wall (you can double check using the map), and try to make it look neat. Don't put it on signs, door frames, or light fixtures.";
                    const buttons = [{
                        type: "web_url",
                        title: "Open Map",
                        url: url,
                        webview_height_ratio: "tall",
                        messenger_extensions: true,
                    }] as Array<FBTypes.MessengerButton>;
                    return bot.FBPlatform.sendButtonMessage(task.volunteerFbid, text, buttons);
                }).then(() => {
                    return bot.sendMessage(
                        task.volunteerFbid,
                        msgUtil.quickReplyMessage("Tell me when you are 'done'!", ["done"])
                    );
                });
            },
            "msg:done": function(task) {
                new BeaconSlot({id: task.context.currentSlot})
                .save({beacon_id: task.context.currentBeacon, in_progress: false}, {patch: true})
                .then(function(slot) {
                    return new Beacon({id: task.context.currentBeacon})
                    .save({slot: task.context.currentSlot}, {patch: true});
                })
                .then(() => {
                    task.context.currentBeacon = null;
                    task.context.currentSlot = null;
                    task.context.numBeacons--;
                    if (task.context.numBeacons === 0) {
                        task.saveScore(task.context.score);
                        if (task.context.toReturn.length > 0) {
                            this.transition(task, "return");
                        } else {
                            this.handle(task, "complete");
                        }
                    } else {
                        return bot.sendMessage(
                            task.volunteerFbid,
                            {text: "Thanks, let's place another!"}
                        ).then(() => this.transition(task, "go"));
                    }
                });
            }
        },
        return: {
            _onEnter: function(task) {
                bot.sendMessage(
                    task.volunteerFbid,
                    msgUtil.quickReplyMessage(`Please return your extra beacon(s) to the Supply Station. Let me know when you are 'done'.`, ["done"])
                );
            },
            "msg:done": function(task: Task) {
                BeaconSlot.getProgress()
                .then(stats => bot.sendMessage(
                    task.volunteerFbid,
                    {text: `We are ${stats.percent}% done! Beacons placed: ${stats.completed}/${stats.total}`}
                )).then(() => this.handle(task, "complete"));
            }
        }
    }
});

export const getNewTask = function(vol: Volunteer) {
    let beaconSlots = BeaconSlot.getNSlots(1, vol.deploymentId);
    let beacons = Beacon.collection<Beacon>()
    .query({
        slot: null,
        deployment_id: vol.deploymentId,
    })
    .count();

    return Promise.join(beaconSlots, beacons, (slots, beacons) => {
        if (slots.length === 0 || beacons === 0) {
            return null;
        } else {
            return new Task({
                template_type: "place_beacons",
                deployment_id: vol.deploymentId
            });
        }
    });
};