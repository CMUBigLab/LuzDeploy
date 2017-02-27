import * as http from "http";
import * as path from "path";

import * as express from "express";
import * as logger from "winston";
import * as FBTypes from "facebook-sendapi-types";
import * as Promise from "bluebird";
import * as _ from "lodash";
import * as bodyParser from "body-parser";

import {bot} from "./bot";
import * as cron from "./cron";
import * as errors from "./errors";
import * as routes from "./routes";
import * as handlers from "./handlers";
import {Admin} from "./models/admin";
import {Volunteer} from "./models/volunteer";

const app = express();

function sendAdminError(error: Error) {
    Admin.fetchAll()
        .then(admins => {
            admins.forEach((a: Admin) => a.sendMessage({text: error.stack.slice(0, 640)}));
        }).catch(err => logger.error(`admin logging error ${err}`));

}

function expressErrorHandler(err: Error, req: express.Request, res: express.Response,
next: express.NextFunction) {
    // log error
    logger.error(err.message);
    sendAdminError(err);
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
    sendAdminError(error);
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

export let server;

export function startListening(port: number = (process.env.PORT || 3000), callback?) {
    server = app.listen(port, () => {
        logger.info(`Echo bot server running at port ${server.address().port}.`);
        if (callback) {
            callback(server);
        }
    });
}

if (require.main === module) {
    startListening();
    cron.setupJobs();
}