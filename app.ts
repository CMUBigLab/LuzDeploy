import * as http from "http";
import * as path from "path";

import * as express from "express";
import * as logger from "winston";
import * as FBTypes from "facebook-sendapi-types";
import * as rawbody from "raw-body";
import * as Promise from "bluebird";
import * as _ from "lodash";

import * as errors from "./errors";
import * as routes from "./routes";
import * as handlers from "./handlers";
import signatureCheck from "./signature";

import {Bot} from "./bot";
const Admin = require("./models/admin");
const Volunteer = require("./models/volunteer");

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
function facebookWebhookHandler(err: Error, req: express.Request, res: express.Response,
next: express.NextFunction) {
     Promise.resolve()
    .then(() => rawbody(req))
    .then((buf: Buffer) => {
      const sig = signatureCheck(buf);
      const body = JSON.parse(buf.toString("utf8"));
      req.body = body;
    })
    .then(() => {
      const callback = req.body as FBTypes.WebhookCallback;
      const events = _.flatten(callback.entry.map(anEntry => anEntry.messaging));
      events.forEach(event => bot.handleEvent(event));
  })
  .catch((err: Error) => {
    logger.error(err.message);
  });
}

process.env.PWD = process.cwd();

process.on("unhandledRejection", function (error: Error, promise: Promise<any>) {
    logger.error("UNHANDLED REJECTION", error.stack);
    Admin.sendError(error).catch(err => logger.error(`admin logging error ${err}`));
});

app.use(express.static(path.join(process.env.PWD, "public")));
app.use(routes.router);
app.get("/fb-webhook", (req: express.Request, res: express.Response) => {

    if (req.query["hub.verify_token"] === process.env.VERIFY_TOKEN) {
      return res.send(req.query["hub.challenge"])
    }

    return res.end("Error, wrong validation token")
  });
app.post("/fb-webhook", facebookWebhookHandler);
app.get("/_status", (req: express.Request, res: express.Response) => {
    res.send({status: "ok"});
});
app.use(expressErrorHandler);
let server = app.listen(process.env.PORT || 3000, () => {
    logger.info(`Echo bot server running at port ${server.address().port}.`);
});