import fb from "facebook-send-api";
import * as FBTypes from "facebook-sendapi-types";
import * as logger from "winston";
import * as moment from "moment";
import * as request from "request";

import * as handlers from "./handlers";

import {Volunteer} from "./models/volunteer";

interface WebhookPayloadFields extends FBTypes.WebhookPayloadFields {
    sender: {
        id: string;
        profile?: FBTypes.FacebookUser;
    };
}

export class Bot {
    FBPlatform: fb;
    ignoring: {[fbid: string]: boolean} = {};

    constructor(token: string) {
         this.FBPlatform = new fb(token);
    }

    sendMessage(fbid: string | number, message: FBTypes.MessengerMessage) {
        if (typeof fbid === "number") {
            fbid = String(fbid);
        }
        return this.FBPlatform.sendMessageToFB(fbid, message)
        .catch((reason) => {
            console.log(reason, reason.response);
            logger.error("Error while trying to send Facebook message via Send API.", reason.response);
        });
    }

    getProfile(fbid: string) {
        return this.FBPlatform.getUserProfile(fbid)
        .catch((err) => {
            logger.error(err);
        });
    }

    handleEvent(payload: FBTypes.WebhookPayload) {
        if (this.ignoring[payload.sender.id]) {
            logger.info(`ignoring message from ${payload.sender.id}`);
            return;
        }
        this.getProfile(payload.sender.id)
        .then((profile): any => {
            logger.info("message received", profile.first_name, profile.last_name);
            (payload as WebhookPayloadFields).sender.profile = profile;
            if (payload.message && payload.message.is_echo) {
                return this.handleEcho(payload);
            } else if (payload.message && !payload.message.text) {
                return this.sendMessage(
                    payload.sender.id,
                    {text: "Sorry, I can only handle text messages right now"}
                );
            } else {
                return this.handleMessage(payload);
            }
        });
    }

    handleEcho(payload: FBTypes.MessengerPayload) {
        logger.info("echo received:", payload);

        // keep track of last time we sent anything to this user
        return new Volunteer({ fbid: payload.recipient.id })
        .save(
            { "lastMessaged": moment().format("YYYY-MM-DD HH:mm:ss") },
            { patch: true, require: false }
        ).then(() => {
            let msg = payload.message.text;
            if (msg && msg.startsWith("bot:")) {
                if (msg.slice(4) === "on") {
                    delete this.ignoring[payload.recipient.id];
                } else if (msg.slice(4) === "off") {
                    this.ignoring[payload.recipient.id] = true;
                } else {
                    logger.error(`invalid echo command ${msg}`);
                }
            }
        });
    }

    handleMessage(payload: FBTypes.MessengerPayload) {
        // Keep track of last time we received anything from this user
        new Volunteer({ fbid: payload.recipient.id })
        .save(
            { "lastResponse": moment().format("YYYY-MM-DD HH:mm:ss") },
            { patch: true, require: false }
        ).then(() => {
            const reply = this.sendMessage.bind(this, payload.recipient.id);
            handlers.dispatchMessage(payload, reply);
        });
    }

    handlePostback(payload: WebhookPayloadFields) {
        const reply = this.sendMessage.bind(this, payload.sender.id);
        handlers.dispatchPostback(payload, reply);
    }
}