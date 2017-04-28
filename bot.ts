import * as handlers from "./handlers";
import * as FBTypes from "facebook-sendapi-types";
import fb from "facebook-send-api";
import * as moment from "moment";
import * as rpErrors from "request-promise/errors";
import * as logger from "winston";

import {DATE_FORMAT} from "./config";
import {Admin} from "./models/admin";
import {Volunteer} from "./models/volunteer";

export interface WebhookPayloadFields extends FBTypes.WebhookPayloadFields {
    sender: {
        id: string;
        profile?: FBTypes.FacebookUser;
        admin?: Admin,
        volunteer?: Volunteer
    };
}

class Bot {
    FBPlatform: fb;
    
    constructor(token: string) {
        this.FBPlatform = new fb(token);
    }
    
    sendMessage(fbid: string | number, message: FBTypes.MessengerMessage) {
        if (typeof fbid === "number") {
            fbid = String(fbid);
        }
        logger.info("sending message", {fbid, message});
        return this.FBPlatform.sendMessageToFB(fbid, message)
        .catch((error) => {
            logger.error(
            "Error while trying to send Facebook message via Send API.",
            error.response.body.error
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
        new Volunteer({fbid: payload.sender.id}).fetch()
        .then((vol: Volunteer) => {
            if (vol && vol.ignoring) {
                logger.info(`ignoring message from ${payload.sender.id}`);
                return;
            } else {
                return this.getProfile((payload.message && payload.message.is_echo) ? payload.recipient.id : payload.sender.id)
                .then((profile): any => {
                    if (profile) {
                        (payload as WebhookPayloadFields).sender.profile = profile;
                    } else {
                        (payload as WebhookPayloadFields).sender.profile = null;
                    }
                    if (payload.message && payload.message.is_echo) {
                        return this.handleEcho(payload);
                    } else if (payload.message && !payload.message.text) {
                        return this.sendMessage(
                        payload.sender.id,
                        {text: "Sorry, I can only handle text messages right now"}
                        );
                    } else if (payload.postback) {
                        return this.handlePostback(payload);
                    } else {
                        return this.handleMessage(payload);
                    }
                });
            }
        });
        }
        
        handleEcho(payload: FBTypes.MessengerPayload) {
            logger.info("echo received:", payload);
            
            // keep track of last time we sent anything to this user
            return new Volunteer({ fbid: payload.recipient.id })
            .save(
                { last_messaged: moment().format(DATE_FORMAT) },
                { patch: true, require: false }
            );
        }
        
        handleMessage(payload: FBTypes.WebhookPayloadFields) {
            logger.info("message received:", payload);
            // Keep track of last time we received anything from this user
            new Volunteer({ fbid: payload.sender.id })
            .save(
            { last_response: moment().format(DATE_FORMAT) },
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
    
    export type ReplyFunc = (message: FBTypes.MessengerMessage) => Promise<FBTypes.MessengerResponse>;
    
    
    export const bot = new Bot(process.env.PAGE_ACCESS_TOKEN);
    