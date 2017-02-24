import * as http from "http";
import * as path from "path";

import * as express from "express";
import * as logger from "winston";
import * as FBTypes from "facebook-sendapi-types";
import * as Promise from "bluebird";
import * as _ from "lodash";
import * as bodyParser from "body-parser";
import fb from "facebook-send-api";
import * as moment from "moment";
import * as rpErrors from "request-promise/errors";

import * as errors from "./errors";
import * as routes from "./routes";
import * as handlers from "./handlers";
import {Admin} from "./models/admin";
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

const app = express();
export const bot = new Bot(process.env.PAGE_ACCESS_TOKEN);

function expressErrorHandler(err: Error, req: express.Request, res: express.Response,
next: express.NextFunction) {
    // log error
    logger.error(err.message);
    Admin.sendError(err);
    if (err instanceof errors.BadRequestError) {
        res.status(400).send({ error: err.message });
    } else {
        res.status(500).end();
    }
}

// source: https://github.com/fyndme/facebook-send-api/issues/1
function facebookWebhookHandler(req: express.Request, res: express.Response, next) {
      const callback = req.body as FBTypes.WebhookCallback;
      const events = _.flatten(callback.entry.map(anEntry => anEntry.messaging));
      events.forEach(event => bot.handleEvent(event));
      res.send("OK");
}

process.env.PWD = process.cwd();

process.on("unhandledRejection", function (error: Error, promise: Promise<any>) {
    logger.error("UNHANDLED REJECTION", error.stack);
    Admin.sendError(error)
    .catch(err => logger.error(`admin logging error ${err}`));
});

app.use(express.static(path.join(process.env.PWD, "public")));
app.use(routes.router);
app.get("/fb-webhook", (req: express.Request, res: express.Response) => {

    if (req.query["hub.verify_token"] === process.env.VERIFY_TOKEN) {
      return res.send(req.query["hub.challenge"])
    }

    return res.end("Error, wrong validation token")
  });
app.post("/fb-webhook", bodyParser.json(), facebookWebhookHandler);
app.get("/_status", (req: express.Request, res: express.Response) => {
    res.send({status: "ok"});
});
app.use(expressErrorHandler);
const server = app.listen(process.env.PORT || 3000, () => {
    logger.info(`Echo bot server running at port ${server.address().port}.`);
});