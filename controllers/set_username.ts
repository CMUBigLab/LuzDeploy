let machina = require("machina");
import * as FBTypes from "facebook-sendapi-types";

import * as config from "../config";
import {bot} from "../bot";
import * as msgUtil from "../message-utils";
import {FingerprintPoint} from"../models/fingerprint-point";

export const SetUsernameFsm = machina.BehavioralFsm.extend({
    namespace: "set_username",
    initialState: "get_username",
    states: {
        get_username: {
            _onEnter: function(user) {
                let self = this;
                bot.FBPlatform.createButtonMessage(user.fbid)
                .text(`Hi, ${user.firstName}! In the spirit of friendly competition, we have a leaderboard that shows a score based on how many tasks you have done. Your nickname been randomly selected as "${user.username}". Would you like to change it?`)
                .postbackButton("Change Nickname", "")
                .postbackButton("Leave As Is", "")
                .send();
            },
            "change": "get_input",
            "leave": "completed"
        },
        get_input: {
            _onEnter: function(user) {
                const text = "Ok, what would you like it to be?";
                 bot.FBPlatform.sendTextMessage
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