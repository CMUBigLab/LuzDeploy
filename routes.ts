import * as express from "express";
import * as _ from "lodash";
import * as bodyParser from "body-parser";
import * as Promise from "bluebird";

import bookshelf = require("./bookshelf");
import {bot} from "./bot";
import * as handlers from "./handlers";
import * as msgUtils from "./message-utils";
import * as errors from "./errors";

const TaskTemplate = require("./models/task-template");
const Volunteer = require("./models/volunteer");
const Task = require("./models/task");
const Admin = require("./models/admin");
const Beacon = require("./models/beacon");
const Deployment = require("./models/deployment");
const FingerprintPoint = require("./models/fingerprint-point");
const FingerprintSample = require("./models/fingerprint-sample");

export const router = express.Router();

// Creates a new volunteer.
router.post("/consent", bodyParser.urlencoded({extended: true}), function(req, res, next) {
    const vol = {
        fbid: req.body.fbid,
        consentDate: new Date(),
        firstName: null,
        lastName: null
    };
    bot.getProfile(req.body.fbid)
    .then((profile) => {
        vol.firstName = profile.first_name;
        vol.lastName = profile.last_name;
        return new Volunteer().save(vol).then(() => {
            res.send("<h1>Thanks! Please press the cancel button to return to the bot chat.</h1>");
            handlers.sendDeploymentMessage(req.body.fbid);
        });
    }).catch(next);
});

router.post("/webhook", bodyParser.urlencoded({extended: true}), function(req, res, next) {
    if (!req.body.wid || !req.body.message) {
        return res.status(400).send("message and wid are required");
    }
    handlers.handleWebhook(req).then(function(err) {
        if (!err) {
            res.send("OK");
        } else {
            res.status(400).send(err);
        }
    });
});

// Batch add tasks.
router.post("/tasks", bodyParser.json(), function(req, res, next) {
    let templates = _.uniq(_.map(req.body, "template_type"));
    TaskTemplate.collection()
    .query("where", "type", "in", templates)
    .fetch()
    .then(function(models) {
        return models.reduce((acc, t) => {
            acc[t.get("type")] = t;
            return acc;
        }, {});
    })
    .then(function(templates) {
        let ps = req.body.map(function(task) {
            if (!(task.template_type in templates)) {
                throw new errors.BadRequestError(`No template named ${task.template_type}`);
            }
            let template = templates[task.template_type];
            const params = _.omit(task,
                ["template_type", "deployment_id", "dependencies"]
            );
            return new Task({
                instructionParams: JSON.stringify(params),
                estimatedTime: template.get("estimatedTime"),
                deploymentId: task.deployment_id,
                completedWebhook: template.get("completedWebhook"),
                templateType: task.template_type,
            }).save();
        });
        return Promise.all(ps);
    })
    .then(results => {
        res.status(201).send(results.map(r => r.serialize()));
    })
    .catch(next);
});

// Upload sweep data
router.post("/sweep-data", bodyParser.urlencoded({extended: true}), function(req, res, next) {
    console.log("got sweep data", req.body);
    let now = bookshelf.knex.fn.now();
    let missing = [];
    let present = [];
    if (req.body.missing) {
        missing = req.body.missing.split(",").map(Number);
    }
    if (req.body.present) {
        present = req.body.present.split(",").map(Number);
    }
    let a = Beacon.collection().query()
    .whereIn("minor_id", missing)
    .update({last_swept: now, exists: false}, "slot")
    .then(function(slots) {
        return Promise.map(slots, function(slot) {
            return new Task({
                deploymentId: 1,
                templateType: "replace_beacon",
                instructionParams: {
                    slot: slot
                }
            }).save(null, {method: "insert"});
        });
    });
    let b = Beacon.collection().query()
    .whereIn("minor_id", present)
    .update({last_seen: now, last_swept: now, exists: true});

    Promise.join(a, b)
    .then(function() {
        res.sendStatus(200);
    }).catch(function(err) {
        console.log(err);
        res.sendStatus(500);
    });
});

interface FingerprintSample {
    bid: Number;
    rssi: Number;
}

interface Fingerprint {
    location: {
        lat: Number,
        long: Number,
        floor: Number
    };
    sample: FingerprintSample[];
}

// Upload fingerprint data
router.post("/fingerprint-data", bodyParser.json(), function(req, res, next) {
    const fingerprints = req.body as Fingerprint[];
    console.log("got fingerprint data", req.body);
    Promise.map(fingerprints, function(fingerprint) {
        if (fingerprint.sample.length <= 0) return;
        let point = fingerprint.location;
        return new FingerprintPoint({
            floor: point.floor,
            long: point.long,
            lat: point.lat
        }).fetch()
        .then(function(fingerprintPoint) {
            if (fingerprintPoint == null) {
                return new FingerprintPoint({
                    floor: point.floor,
                    long: point.long,
                    lat: point.lat
                }).save();
            } else {
                return fingerprintPoint;
            }
        }).then(function(fingerprintPoint) {
            return new FingerprintSample({
                fingerprintId: fingerprintPoint.get("id"),
                data: JSON.stringify(fingerprint.sample)
            }).save();
        });
    }).then(function() {
        res.sendStatus(200);
    }).catch(function(err) {
        console.log(err);
        res.sendStatus(500);
    });
});

router.post("/send-message", bodyParser.json(), function(req, res, next) {
    let fbid = req.body.fbid;
    let text = req.body.text;
    let message = req.body.message;
    let qrs = req.body.quick_replies;
    let buttons = req.body.buttons;
    let mass = req.body.mass;
    let deploymentId = req.body.deployment_id;
    if (qrs) {
        message = msgUtils.quickReplyMessage(text, qrs);
    } else if (buttons) {
        message = msgUtils.buttonMessage(text, buttons);
    }
    if (mass === true) {
        new Deployment({id: deploymentId}).volunteers()
        .fetch()
        .then(function(volunteers) {
            console.log("sending message to volunteers:", volunteers.length);
            volunteers.forEach(v => v.sendMessage(message));
        }).then(function() {
            res.sendStatus(200);
        })
        .catch(function(err) {
            console.log(err);
            res.sendStatus(500);
        });
    } else {
        bot.sendMessage(fbid, message)
        .then(() => res.sendStatus(200));
    }
});