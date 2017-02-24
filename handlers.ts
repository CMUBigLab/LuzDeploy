import _ = require("lodash");
import Promise = require("bluebird");
import * as fb from "facebook-send-api";
import * as FBTypes from "facebook-sendapi-types";

import {bot} from "./app";
import * as config from "./config";
import msgUtil = require("./message-utils");

import {Deployment} from "./models/deployment";
import {Volunteer} from "./models/volunteer";
import {Admin} from "./models/admin";
import {Task} from "./models/task";
import {TaskFsm, taskControllers} from "./controllers/task";

const messageHandlers = {
    "hello": {
        handler: greetingMessage,
        description: "A greeting!"
    },
    "ask": {
        handler: askMessage,
        description: "Ask for a new task."
    },
    "mentor": {
        handler: mentorMessage,
        description: "Ask for help from others."
    },
    "leave": {
        handler: leaveMessage,
        description: "Quit."
    },
    "help": {
        handler: helpMessage,
        volRequired: true,
        description: "List commands."
    },
    "startdep": {
        handler: startDeployment,
        adminRequired: true,
        description: "start a deployment"
    },
    "sendsurvey": {
        handler: sendSurvey,
        adminRequired: true,
        description: "send survey"
    },
    "mass": {
        handler: massMessage,
        adminRequired: true,
        description: "send message to all"
    },
};

const postbackHandlers = {
    "join_deployment": {
        handler: joinDeployment,
        volRequired: false,
    },
    "assign_task": {
        handler: assignTask,
        volRequired: false,
        adminRequired: true,
    },
    "send_mentor": {
        handler: mentorMessage,
        volRequired: true,
    },
    "list_commands": {
        handler: listCommands,
    },
    "cancel_mentor": {
        handler: cancelMentor,
        volRequired: true,
    },
    "task_score": {
        handler: taskScore,
        volRequired: true,
    },
    "accept_task": {
        handler: acceptTask,
        volRequired: true,
    },
};

const aliases = {
    "d": "done",
    "s": "start",
    "a": "ask",
    "hi": "hello",
    "hey": "hello",
    "h": "help"
};

function getVolTask(vol) {
    return vol.related("currentTask").fetch()
    .then(function(task) {
        if (!task) {
            return null;
        } else {
            if (task.get("templateType") === "fingerprint" || task.get("templateType") === "sweep_edge" || task.get("templateType") === "place_beacons" || task.get("templateType") === "replace_beacon") {
                task.loadState();
                return task;
            } else {
                throw new Error("task fsm not implemented");
            }
        }
    });
}

export function dispatchMessage(payload, reply) {
    getAdminAndVolunteer(payload)
    .then((payload) => {
        if (payload.sender.volunteer) {
            const vol = payload.sender.volunteer;
            if (vol.get("deploymentId") === null) {
                sendDeploymentMessage(payload.sender.id);
                return;
            } else if (!payload.sender.admin && !vol.related("deployment").get("active")) {
                return reply({text: "This deployment is paused! We will let you know when we start back up."});
            }
        } else {
            onboardVolunteer(payload, reply);
            return;
        }
        // Is this needed?
        if (!(payload.sender.admin || payload.sender.volunteer)) {
            return;
        }

        const values = payload.message.text.toLowerCase().split(" ");
        let command = values[0];
        if (command in aliases) command = aliases[command];

        if (command in messageHandlers) {
            const commandHandler = messageHandlers[command];
            if (commandHandler.requiredArgs  && values.length - 1 !== commandHandler.requiredArgs) {
                reply({text: `The ${command} command requires ${commandHandler.requiredArgs} arguments.`});
            } else if (messageHandlers[command].adminRequired && !payload.sender.admin) {
                reply({text: `Permission denied`});
            } else {
                commandHandler.handler(payload, reply, values.slice(1));
            }
        } else if (payload.sender.volunteer && payload.sender.volunteer.get("currentTask")) {
            getVolTask(payload.sender.volunteer)
            .then(function(task) {
                TaskFsm.userMessage(task, command);
            });
        } else {
            let cmds = _.keys(messageHandlers);
            reply({text: `I don't know how to interpret '${command}'. Try 'ask' for a new task or 'help' for more info.`});
        }
    });
};
export function handleWebhook(req) {
    return new Volunteer()
    .where({fbid: req.body.wid})
    .fetch({withRelated: ["deployment"]})
    .then(vol => {
        if (vol) {
            return getVolTask(vol);
        } else {
            throw new Error(`Could not find volunteer with id ${req.body.wid}.`);
        }
    })
    .then(function(task) {
        if (task) {
            return TaskFsm.webhook(task, req.body.message);
        } else {
            throw new Error("Could not find active task.");
        }
    });
};

function getAdminAndVolunteer(payload) {
    return Promise.join(
        new Admin().where({fbid: payload.sender.id}).fetch(),
        new Volunteer().where({fbid: payload.sender.id}).fetch({withRelated: ["deployment"]}),
        (admin, vol) => {
            if (admin) payload.sender.admin = admin;
            if (vol) payload.sender.volunteer = vol;
            return payload;
        }
    );
}

export function dispatchPostback(payload, reply) {
    getAdminAndVolunteer(payload)
    .then((payload) => {
        const postback = JSON.parse(payload.postback.payload);
        if (postback.type in postbackHandlers) {
            const found = postbackHandlers[postback.type];
            payload.postback.payload = postback;
            found.handler(payload, reply, payload.postback.payload.args);
        } else {
            throw new Error(`invalid postback: ${payload.postback.payload}`);
        }
    });
};

function greetingMessage(payload, reply) {
    let text = "Hi! If you want a new task, use the command 'ask'.";
    reply(msgUtil.quickReplyMessage(text, ["ask"]));
}

function leaveMessage(payload, reply) {
    const vol = payload.sender.volunteer;
    vol.currentTask().fetch()
    .then((task) => {
        if (task) {
            return vol.unassignTask();
        } else {
            return Promise.resolve();
        }
    })
    .then(() => {
        return vol.save({deploymentId: null}, {patch: true});
    })
    .then(() => {
        reply({text: "Sorry to see you go! We are always happy to have you back."});
    });
}

function startDeployment(payload, reply, args) {
    return new Deployment({id: args[0]}).fetch()
    .then(deployment => {
        if (deployment.get("active")) {
            reply({text: "already started"});
        } else {
            return deployment.start().then(d => {
                reply({text: "started"});
                return d.volunteers().fetch()
                .then(volunteers => {
                    volunteers.forEach(v => {
                        v.sendMessage({text: "Hi! We are ready to get started for our deployment today! To get your first task, type the command 'ask'. Want an overview of the whole project? Stop by our table on GHC 5th floor near the Randy Pausch bridge."});
                        v.sendMessage({text: "If you decide you need to leave the deployment, type 'leave'. You can always rejoin later! For bug reports and questions, stop by our table or email cgleason@cs.cmu.edu."});
                    });
                });
            });
        }
    });
}

function massMessage(payload, reply, args) {
    if (!args.length) {
        reply({text: "need deploy id"});
        return;
    }
    const start = payload.message.text.indexOf(args[0]) + 1;
    const msg = payload.message.text.slice(start).trim();
    if (!msg.length) {
        reply({text: "need message!"});
        return;
    }
    return new Deployment({id: args[0]}).fetch()
    .then(deployment => {
        return deployment.volunteers().fetch()
        .then(volunteers => {
            volunteers.forEach(v => {
                v.sendMessage({text: msg});
            });
            reply({text: "sent"});
        });
    });
}


function sendSurvey(payload, reply, args) {
    return new Deployment({id: args[0]}).fetch()
    .then(deployment => {
        return deployment.volunteers().fetch()
        .then(volunteers => {
            volunteers.forEach(v => {
                let buttons = [{
                    type: "web_url",
                    url: `https://docs.google.com/a/andrew.cmu.edu/forms/d/e/1FAIpQLSehyEKkp7nZFS01hbIWMVwAgEWo0sRjs8_NkJ46pku9CZMMIg/viewform?entry.403963864=${v.get("fbid")}`,
                    title: "Open Form"
                }];
                let text = `Hi ${v.get("firstName")}! We need to check up on some older beacons. Do you have time in the next few days to help us for a few minutes? If you do, and have an iOS device, please let us know using this form!`;
                return v.sendMessage(msgUtil.buttonMessage(text, buttons));
            });
            reply({text: "sent"});
        });
    });
}

function taskScore(payload, reply, args) {
    const vol = payload.sender.volunteer;
    return vol.currentTask().fetch().then(task => {
        if (!task || !task.get("startTime") || task.get("completed")) {
            return reply({text: "You don't seem to have an active task. Did you forget to 'start' it?"});
        } else {
            return task.save({score: args.score}, {patch: true})
            .then(function() {
                reply({text: "Great, now just type 'done' to complete the task!"});
            });
        }
    });
}

function helpMessage(payload, reply) {
    const vol = payload.sender.volunteer;
    let buttons = [{
        type: "postback",
        title: "List Commands",
        payload: JSON.stringify({
            type: "list_commands",
            args: {}
        })
    },
    {
        type: "postback",
        title: "Send Mentor",
        payload: JSON.stringify({
            type: "send_mentor",
            args: {}
        })
    }];
    return reply(msgUtil.buttonMessage(
        "Here is a list of commands you can say to me! Press 'Send Mentor' to have another volunteer come help you.",
        buttons
    ));
}

function listCommands(payload, reply) {
    let aliasLookup = _.invert(aliases);
    let msg = "Here are the commands I know how to process:\n";
    for (let k in messageHandlers) {
        if (!messageHandlers[k].adminRequired) {
            let alias = "";
            if (aliasLookup[k]) {
                alias = ` (${aliasLookup[k]})`;
            }
            msg = msg + `${k}${alias}: ${messageHandlers[k].description}\n`;
        }
    }
    reply({text: msg});
}

// warning: used by message and by postback
function mentorMessage(payload, reply) {
    const vol = payload.sender.volunteer;
    vol.currentTask().fetch().then(task => {
        if (!task) {
            return reply({text: "We can't send a mentor to you until you have a task. Try 'ask' to get a new one."});
        } else {
            return vol.getMentorshipTask()
            .then(function(task) {
                if (task) {
                    return reply({text: "We are already searching for a good mentor to send you."});
                } else {
                    return vol.createMentorshipTask()
                    .then(function(task) {
                        let text =  "Okay, we will let you know when someone is on their way! You can cancel this request at any time using the button below.";
                        let buttons = [{
                            type: "postback",
                            title: "Cancel Help Request",
                            payload: JSON.stringify({
                                type: "cancel_mentor",
                                args: {taskId: task.get("id")}
                            })
                        }];
                        return reply(msgUtil.buttonMessage(text, buttons));
                    });
                }
            });
        }
    });
}

function cancelMentor(payload, reply, args) {
    const mentee = payload.sender.volunteer;
    return new Task({id: args.taskId}).fetch()
    .then(task => {
        if (!task) {
            return reply({text: "Hmm, that task was not found."});
        } else {
            return task.assignedVolunteer().fetch()
            .then(vol => {
                if (vol) {
                    return vol.save({current_task: null}, {patch: true})
                    .then(() => {
                        return task.destroy();
                    })
                    .then(() => {
                        vol.sendMessage({text: `${mentee.name} figured it out! I'm going to give you another task.`});
                        return vol.getNewTask()
                        .then(function(task: Task) {
                            let controller = taskControllers[task.get("type")];
                            return controller.start(task);
                        });
                    });
                } else {
                    return task.destroy();
                }
            })
            .then(() => {
                return reply({text: "No problem, help cancelled!"});
            });
        }
    });
}

function onboardVolunteer(payload, reply) {
  const response = {
    "attachment": {
      "type": "template",
        "payload": {
          "template_type": "button",
              "text": `Hi! ${payload.sender.profile.first_name}, I am the LuzDeploy bot. To continue you must complete the following consent form.`,
              "buttons": [{
                type: "web_url",
                title: "Open Consent Form",
                url: `${config.BASE_URL}/consent.html?fbid=${payload.sender.id}`
              }]
            }
          }
      };
      reply(response);
}

export function sendDeploymentMessage(fbid) {
  Deployment.collection().query({"active": true}).fetch()
  .then(function(deployments) {
    if (deployments.length === 0) {
        const message = {
            text: "Hi! I am the LuzDeploy bot. We are launching on Thursday at 2pm in Gates-Hillman Center! I will reach out to you then with more information, and I hope you can help us out! (I will keep repeating this message, so contact Cole Gleason at m.me/coleagleason for more info.)"
        };
        return bot.sendMessage(fbid, message);
    } else {
        const response = bot.FBPlatform.createButtonMessage(fbid)
        .title("Which deployment would you like to join?");
        deployments.forEach(d => {
            const payload = JSON.stringify({
                type: "join_deployment",
                args: {
                    id: d.get("id"),
                    new_ask: d.get("type") === "eventBased"
                }
            });
            response.postbackButton(d.get("name"), payload);
        });

        return response.send();
    }
  });
}

module.exports.sendDeploymentMessage = sendDeploymentMessage;

function assignTask(payload, reply, args) {
    new Volunteer({fbid: args.volId}).fetch()
    .then(vol => {
        if (!vol)
        {
            reply({text: "Invalid volunteer."});
            return;
        }
        new Task({id: args.taskId}).fetch()
            .then(task => {
                if (!task) {
                    reply({text: "Invalid task."});
                     return;
                }
                task.save({volunteer_fbid: vol.get("fbid")}, {patch: true}).then(() => {
                    new Admin({fbid: args.adminId}).fetch().then(admin => {
                        admin.sendMessage({text: `Assigned task ${task.id} to ${vol.name}.`});
                    });
                });
            });
    });
    // TODO: assign task based on id args
    // TODO: if already has assignedVol, then error
}

function joinDeployment(payload, reply, args) {
    const vol = payload.sender.volunteer;
    let newTask = false;
    if (args.new_task) newTask = args.new_task;
    Promise.join(
        vol.currentTask().fetch(),
        new Deployment().where({id: args.id}).fetch(),
        function(task, deployment) {
            if (!deployment) throw new Error(`invalid deployment id: ${args.id}`);
            let promise = null;
            if (task) {
                promise = vol.unassignTask();
            } else {
                promise = Promise.resolve();
            }
            promise.then(function() {
                return vol.save({deployment_id: deployment.get("id")});
            }).then(function() {
                let text = `Great! Welcome to the ${deployment.get("name")} deployment!`;
                if (!newTask) text += ` Say 'ask' for a new task.`;
                reply(msgUtil.quickReplyMessage(text, ["ask"]));
            }).then(function() {
                if (newTask) getAndAssignVolTask(vol);
            });
        }
    );
}

function getAndAssignVolTask(vol) {
    return vol.getNewTask()
    .then(function(task) {
        if (!task) {
            return vol.sendMessage({text: "There are no tasks available right now."});
        } else {
            TaskFsm.assign(task, vol)
            .then(function() {
                TaskFsm.start(task);
            });
        }
    });
}

function askMessage(payload, reply) {
    // Get a task in the pool, and ask if he wants to do it.
    const vol = payload.sender.volunteer;
    return getVolTask(vol).then(function(task) {
        if (task) {
            reply({text: "You already have a task! Finish that first."});
            return;
        } else {
            return getAndAssignVolTask(vol);
        }
    });
}


function acceptTask(payload, reply, args) {
    const vol = payload.sender.volunteer;
    return getVolTask(vol)
    .then(task => {
        if (!task) {
            reply({text: "You don't have a task."});
            return;
        }
        let controller = taskControllers[task.get("type")];
        return controller.start(task);
    });
}