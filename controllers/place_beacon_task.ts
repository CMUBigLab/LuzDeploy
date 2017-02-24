let machina = require("machina");
import * as Promise from "bluebird";

import * as config from "../config";
import {bot} from "../bot";
import * as msgUtil from "../message-utils";

import {BeaconSlot} from "../models/beacon-slot";
import {Beacon} from "../models/beacon";

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
        } else {
            bot.sendMessage(
                task.get("volunteerFbid"),
                {text: "Later, please return that beacon to the supply station. For now we will plave another beacon."}
            );
            this.transition(task, "which");
        }
    },
    states: {
        supply: {
            _onEnter: function(task) {
                let text = "In this task you will place beacons in the environment that will be used by people with visual impairments to navigate. Please go to the Supply Station (across from Gates Cafe register). Tell me when you are 'there'.";
                bot.sendMessage(
                    task.get("volunteer_fbid"),
                    msgUtil.quickReplyMessage(text, ["there"])
                );
            },
            "msg:there": "pickup",
        },
        pickup: {
            _onEnter: function(task) {
                let text = "Great! To open the lockbox, type the code 020217, then #, then turn the switch. Now grab as many beacons as you are willing to place. Please close and lock the box. Tell me how many you took (you can press a button or type a number).";
                bot.sendMessage(
                    task.get("volunteerFbid"),
                    msgUtil.quickReplyMessage(text, ["1", "3", "5", "10"])
                );
            },
            number: function(task, n) {
                task.context = {
                    initialBeacons: n,
                    numBeacons: n,
                    currentSlot: null,
                    currentBeacon: null,
                    toReturn: [],
                };
                let self = this;
                BeaconSlot.getNSlots(n, task.get("deploymentId"))
                .then(function(slots) {
                    if (slots.length !== n) {
                        // TODO: handle case when slots.length == 0
                        let text = `I could only find ${slots.length} places needing beacons. Please return any excess beacons.`;
                        bot.sendMessage(task.get("volunteerFbid"), {text: text});
                        task.context.numBeacons = slots.length;
                    }
                    task.context.slots = slots.map(s => s.get("id"));
                    return Promise.map(slots, function(slot) {
                        return slot.save({in_progress: true});
                    });
                }).then(function() {
                    self.transition(task, "go");
                });
            },
        },
        go: {
            _onEnter: function(task) {
                task.context.currentSlot = task.context.slots.pop(1);
                // TODO: fix
                // "webview_height_ratio": "tall",
                //   "messenger_extensions": true,
                const url = `${config.BASE_URL}/map/?advanced&hidden&beacon=${task.context.currentSlot}`
                const text = `You have ${task.context.numBeacons} beacons to place. Please go to the location marked on the map below.`;
                bot.FBPlatform.createButtonMessage(task.get("volunteerFbid"))
                .text(text)
                .webButton("Open Map", url)
                .send()
                .then(() => {
                    bot.sendMessage(
                        task.get("volunteerFbid"),
                        msgUtil.quickReplyMessage("Tell me when you are 'there'!", ["there"])
                    );
                });
            },
            "msg:there": "confirm_empty",
        },
        confirm_empty: {
            _onEnter: function(task) {
                const text = "Is there already a beacon placed on the wall there?";
                bot.sendMessage(
                    task.get("volunteerFbid"),
                    msgUtil.quickReplyMessage(text, ["no", "yes"])
                );
            },
            "msg:yes": function(task) {
                let self = this;
                new BeaconSlot({id: task.context.currentSlot})
                .save({status: "occupied"}, {patch: true})
                .then(function(slot) {
                    return BeaconSlot.getNSlots(1, task.get("deploymentId"));
                }).then(function(slots) {
                    if (slots.length === 0) {
                        let text = `I couldn't find any other spots that need beacons. Please return any excess beacons later.`;
                        bot.sendMessage(task.get("volunteerFbid"), {text: text});
                        task.context.numBeacons -= 1;
                        return;
                    }
                    let text = "Ok, I'll find you a new spot to put the beacon.";
                    bot.sendMessage(task.get("volunteerFbid"), {text: text});
                    task.context.toReturn.push(-1);
                    task.context.slots.push(slots[0]);
                    return slots[0].save({in_progress: true});
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
                bot.sendMessage(
                    task.get("volunteerFbid"),
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
                bot.sendMessage(
                    task.get("volunteerFbid"),
                    msgUtil.quickReplyMessage(text, ["yes", "no"])
                );
            },
            "msg:yes": function(task) {
                let self = this;
                new Beacon({id: task.context.currentBeaconNumber}).fetch({require: true})
                .then(function(beacon) {
                    if (beacon.get("slot") == null) {
                        task.context.currentBeacon = beacon.get("id");
                        self.transition(task, "place");
                    } else {
                        bot.sendMessage(
                            task.get("volunteerFbid"),
                            {text: "Hm, that beacon number is already used elsewhere. We won't use that one."}
                        );
                        self.beaconToReturn(task);
                    }
                })
                .catch(Beacon.NotFoundError, function() {
                    bot.sendMessage(
                        task.get("volunteerFbid"),
                        {text: "Hm, I can't find a record for that beacon. We won't use that one."}
                    );
                    self.beaconToReturn(task);
                });
            },
            "msg:no": function(task) {
                this.transition(task, "which");
            }
        },
        place: {
            _onEnter: function(task) {
                // TODO: fix messenger extensions, etc.
                // "webview_height_ratio": "tall",
                // "messenger_extensions": true,
                const url = `${config.BASE_URL}/map/?advanced&hidden&beacon=${task.context.currentSlot}`;
                let text = "Place the beacon high on the wall (you can double check using the map), and try to make it look neat. Don't put it on signs, door frames, or light fixtures.";
                bot.FBPlatform.createButtonMessage(task.get("volunteerFbid"))
                .webButton("Open Map", url)
                .send()
                .then(() => {
                    bot.sendMessage(
                        task.get("volunteerFbid"),
                        msgUtil.quickReplyMessage("Tell me when you are 'done'!", ["done"])
                    );
                });
            },
            "msg:done": function(task) {
                new BeaconSlot({id: task.context.currentSlot})
                .save({beaconId: task.context.currentBeacon, in_progress: false}, {patch: true})
                .then(function(slot) {
                    return new Beacon({id: task.context.currentBeacon})
                    .save({slot: task.context.currentSlot}, {patch: true});
                })
                .then(() => {
                    task.context.currentBeacon = null;
                    task.context.currentSlot = null;
                    task.context.numBeacons--;
                    if (task.context.numBeacons === 0) {
                        if (task.context.toReturn.length > 0) {
                            this.transition(task, "return");
                        } else {
                            this.handle(task, "complete");
                        }
                    } else {
                        bot.sendMessage(
                            task.get("volunteerFbid"),
                            {text: "Thanks, let's place another!"}
                        );
                        this.transition(task, "go");
                    }
                });
            }
        },
        return: {
            _onEnter: function(task) {
                bot.sendMessage(
                    task.get("volunteerFbid"),
                    msgUtil.quickReplyMessage("Please return your extra beacon(s) to the Supply Station (across from Gates Cafe register). Let me know when you are 'done'.", ["done"])
                );
            },
            "msg:done": function(task) {
                this.handle(task, "complete");
            }
        }
    }
});