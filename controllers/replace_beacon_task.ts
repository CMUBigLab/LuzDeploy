let machina = require("machina");
import * as FBTypes from "facebook-sendapi-types";

import { Task, BeaconSlot } from "../models";
import * as config from "../config";
import {bot} from "../bot";
import * as msgUtil from "../message-utils";

export const ReplaceBeaconTaskFsm = machina.BehavioralFsm.extend({
    namespace: "place_beacons",
    initialState: "supply",
    states: {
        supply: {
            _onEnter: function(task: Task) {
                task.context = {slot: task.instructionParams.slot};
                let text = `One of our beacons needs to be replaced because it isn't working. Please go to the Supply Station (Gates 5th floor near the bridge exit). Tell me when you are 'there'.`;
                bot.sendMessage(
                    task.volunteerFbid,
                    msgUtil.quickReplyMessage(text, ["there"])
                );
            },
            "msg:there": "pickup",
        },
        pickup: {
            _onEnter: function(task) {
                let text = "Great! To open the lockbox, type the code 020217, then #, then turn the switch. Please take a replacement beacon. Please close and lock the box. Let me know when you are 'ready'.";
                bot.sendMessage(
                    task.volunteerFbid,
                    msgUtil.quickReplyMessage(text, ["ready"])
                );
            },
            "msg:ready": "go",
        },
        go: {
            _onEnter: function(task) {
                let params = task.get("instructionParams");
                const url = `${config.BASE_URL}/map/?advanced&hidden&beacon=${params.slot}`;
                const text = "Please go to the location marked on the map below. Tell me when you are 'there'.";
                const buttons = [{
                    type: "web_url",
                    title: "Open Map",
                    url: url,
                    webview_height_ratio: "tall",
                    messenger_extensions: true,
                }] as Array<FBTypes.MessengerButton>;
                bot.FBPlatform.sendButtonMessage(task.get("volunteerFbid"), text, buttons);
            },
            "msg:there": "old_beacon",
        },
        old_beacon: {
            _onEnter: function(task) {
                let text = "Is there an existing beacon at this location?";
                bot.sendMessage(
                    task.volunteerFbid,
                    msgUtil.quickReplyMessage(text, ["yes", "no"])
                );
            },
            "msg:yes": function(task) {
                task.context.return = true;
                this.transition(this, "which");
            },
            "msg:no": function(task) {
                task.context.return = false;
                this.transition(this, "which");
            }
        },
        which: {
            _onEnter: function(task) {
                bot.sendMessage(
                    task.volunteerFbid,
                    {text: `What is the number on the back of the replacement beacon?`}
                );
            },
            number: function(task, id) {
                // TODO: double check if it seems like that beacon doesn't exist or is already placed.
                task.context.currentBeacon = id;
                task.context.return ? this.transition(task, "replace_return") : this.transition(task, "replace");
            }
        },
        replace_return: {
            _onEnter: function(task) {
                // record beacon status as broken and in possession of volunteer
                let text = "Please take down the old beacon and put the new one in it's place. Then return the old beacon to the pickup location. Tell me when you are 'done'.";
                bot.sendMessage(
                    task.volunteerFbid,
                    msgUtil.quickReplyMessage(text, ["done"])
                );
            },
            "msg:done": function(task) {
                this.handle(task, "complete");
            },
        },
        replace: {
            _onEnter: function(task) {
                let text = "Please put the beacon on the wall (you can double check the location using the map above). Tell me when you are 'done'.";
                bot.sendMessage(
                    task.volunteerFbid,
                    msgUtil.quickReplyMessage(text, ["done"])
                );
                // record beacon's status as MIA, look for it.
            },
            "msg:done": function(task) {
                new BeaconSlot({id: task.context.slot})
                .save({beaconId: task.context.currentBeacon}, {patch: true});
                this.handle(task, "complete");
            },
        }
    }
});