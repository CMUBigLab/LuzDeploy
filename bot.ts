import * as handlers from "./handlers";
import {Volunteer} from "./models/volunteer";
import * as FBTypes from "facebook-sendapi-types";
import fb from "facebook-send-api";
import * as moment from "moment";
import * as rpErrors from "request-promise/errors";
import * as logger from "winston";

interface WebhookPayloadFields extends FBTypes.WebhookPayloadFields {
    sender: {
        id: string;
        profile?: FBTypes.FacebookUser;
    };
}

class Bot {
    FBPlatform: fb;
    ignoring: {[fbid: string]: boolean} = {};

    constructor(token: string) {
         this.FBPlatform = new fb(token);
    }

    sendMessage(fbid: string | number, message: FBTypes.MessengerMessage) {
        if (typeof fbid === "number") {
            fbid = String(fbid);
        }
        logger.info("sending message", {fbid, message});
        return this.FBPlatform.sendMessageToFB(fbid, message)
        .catch(rpErrors.StatusCodeError, (reason) => {
            logger.error(
                "Error while trying to send Facebook message via Send API.",
                reason.response.body
            );
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
        this.getProfile(payload.message.is_echo ? payload.recipient.id : payload.sender.id)
        .then((profile): any => {
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

    handleMessage(payload: FBTypes.WebhookPayloadFields) {
        logger.info("message received:", payload);
        // Keep track of last time we received anything from this user
        new Volunteer({ fbid: payload.sender.id })
        .save(
            { "lastResponse": moment().format("YYYY-MM-DD HH:mm:ss") },
            { patch: true, require: false }
        ).then(() => {
            const reply = this.sendMessage.bind(this, payload.sender.id);
            handlers.dispatchMessage(payload, reply);
        });
    }

    handlePostback(payload: WebhookPayloadFields) {
        const reply = this.sendMessage.bind(this, payload.sender.id);
        handlers.dispatchPostback(payload, reply);
    }
}

export const bot = new Bot(process.env.PAGE_ACCESS_TOKEN);