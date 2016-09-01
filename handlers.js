const Deployment = require('./models/deployment')
const Volunteer = require('./models/volunteer')
const Admin = require('./models/admin')
const Task = require('./models/task')
const constants = require('./constants')

const bot = require('./bot')

const _ = require('lodash')
const config = require('./config')
let msgUtil = require('./message-utils')
const messageHandlers = {
	'hello': {
		handler: greetingMessage,
		description: "A greeting!"
	},
	'done': {
		handler: doneMessage,
		description: "Let me know when you finish a task."
	},
	'start': {
		handler: startMessage,
		description: "Tell me when you start a task."
	},
	'ask': {
		handler: askMessage,
		description: "Ask for a new task."
	},
	'reject': {
		handler: rejectMessage,
		description: "Turn down a task you have."
	},
	'mentor': {
		handler: mentorMessage,
		description: "Request that another volunteer come help you."
	},
	'assign': {
		handler: assignMessage,
		description: "Assign a task to a volunteer.",
		adminRequired: true,
	},
	'leave': {
		handler: leaveMessage,
		description: "Leave the deployment (Quit)."
	},
	'help': {
		handler: helpMessage,
		volRequired: true,
		description: "Pull up a menu that allows you to list commands."
	}
}

const postbackHandlers = {
	'join_deployment': {
		handler: joinDeployment,
		volRequired: false,
	},
	'assign_task': {
		handler: assignTask,
		volRequired: false,
		adminRequired: true,
	},
	'send_mentor': {
		handler: mentorMessage,
		volRequired: true,
	},
	'list_commands': {
		handler: listCommands,
	},
	'cancel_mentor': {
		handler: cancelMentor,
		volRequired: true,
	},
	'task_score': {
		handler: taskScore,
		volRequired: true,
	}
}

const aliases = {
	'd': 'done',
	'r': 'reject',
	's': 'start',
	'a': 'ask',
	'hi': 'hello',
	'hey': 'hello',
	'h': 'help'
}

module.exports.dispatchMessage = (payload, reply) => {
	Admin.where({fbid: payload.sender.id}).fetch()
	.then(admin => {
		if (admin) {
			payload.sender.admin = admin
		}
		return Volunteer.where({fbid: payload.sender.id})
		.fetch({withRelated: ['deployment']})
	})
	.then(vol => {
		if (vol) {
			payload.sender.volunteer = vol
			if (vol.get('deploymentId') === null) {
				sendDeploymentMessage(payload.sender.id)
				return
			}
		} else {
			onboardVolunteer(payload, reply)
			return
		}
		if (!(payload.sender.admin || payload.sender.volunteer)) {
			return
		}
		const values = payload.message.text.toLowerCase().split(' ')
		let command = values[0]
		if (command in aliases)
			command = aliases[command]

		if (command in messageHandlers) {
			const commandHandler = messageHandlers[command]
			if (commandHandler.requiredArgs  && values.length-1 != commandHandler.requiredArgs) {
				reply({text: `The ${command} command requires ${commandHandler.requiredArgs} arguments.`})
			} else if (command.adminRequired && !payload.sender.admin) {
				reply({text: `Permission denied`})
			} else {
				commandHandler.handler(payload, reply, values.slice(1))
			}
		} else {
			reply({text: `Command ${command} not found. Try one of the following: ${Object.keys(messageHandlers)}.`})
		}
	})
}

module.exports.dispatchPostback = (payload, reply) => {
	const postback = JSON.parse(payload.postback.payload)
	if (postback.type in postbackHandlers) {
		const found = postbackHandlers[postback.type]
		payload.postback.payload = postback
		if (found.adminRequired) {
			Admin.where({fbid: payload.sender.id}).fetch()
			.then((admin) => {
				payload.sender.admin = admin
				found.handler(payload, reply, payload.postback.payload.args)
			})
		} else if (found.volRequired) {
			Volunteer.where({fbid: payload.sender.id}).fetch()
			.then(vol => {
				payload.sender.volunteer = vol
				found.handler(payload, reply, payload.postback.payload.args)
			})
		} else {
			found.handler(payload, reply, payload.postback.payload.args)
		}
	} else {
		throw new Error(`invalid postback: ${payload.postback.payload}`)
	}
}

function greetingMessage(payload, reply) {
	reply({text: "Hi!"})
}

function leaveMessage(payload, reply) {
	const vol = payload.sender.volunteer
	vol.currentTask().fetch()
	.then((task) => {
		if (task) {
			return vol.unassignTask()
		} else {
			return Promise.resolve()
		}
	})
	.then(() => {
		return vol.save({deploymentId: null}, {patch: true})
	})
	.then(() => {
		reply({text: "Sorry to see you go! We are always happy to have you back."})
	})
}

function taskScore(payload, reply, args) {
	const vol = payload.sender.volunteer
	return vol.currentTask().fetch().then(task => {
		if (!task || !task.get('startTime') || task.get('completed')) {
			return reply({text: "You don't seem to have an active task. Did you forget to 'start' it?"})
		} else {
			return task.save({score: args.score}, {patch: true})
			.then(function() {
				reply({text: "Great, now just type 'done' to complete the task!"})
			})
		}
	})
}

function helpMessage(payload, reply) {
	const vol = payload.sender.volunteer
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
	}]
	return reply(msgUtil.buttonMessage(
		"Here is a list of commands you can say to me! Press 'Send Mentor' to have another volunteer come help you.",
		buttons
	))
}

function listCommands(payload, reply) {
	let aliasLookup = _.invert(aliases)
	let text = "Here are the commands I know how to process:\n"
	for (var k in messageHandlers) {
		if (!messageHandlers[k].adminRequired) {
			var alias = '';
			if (aliasLookup[k]) {
				alias = ` (${aliasLookup[k]})`
			}
			text = text + `${k}${alias}: ${messageHandlers[k].description}\n`
		}
	}
	reply({text})
}

// warning: used by message and by postback
function mentorMessage(payload, reply) {
	const vol = payload.sender.volunteer
	return vol.getMentorshipTask()
	.then(function(task) {
		if (task) {
			return reply({text: "A mentor is already on the way!"})
		} else {
			return vol.createMentorshipTask()
			.then(function(task) {
				const response = {
					"attachment":{
						"type":"template",
						"payload":{
							"template_type": "button",
							"text": "Okay, we will let you know when someone is on their way! You can cancel this request at any time using the button below.",
							"buttons": [{
								type:"postback", 
								title: "Cancel Help Request", 
								payload: JSON.stringify({
									type: "cancel_mentor",
									args: {taskId: task.get('id')}
								})
							}]
						}
					}
				}
				return reply(response)
			})
		}
	})
}

function cancelMentor(payload, reply, args) {
	const mentee = payload.sender.volunteer
	return Task.forge({id: args.taskId}).fetch()
	.then(task => {
		if (!task) {
			return reply({text: "Hmm, that task was not found."})
		} else {
			task.assignedVolunteer().fetch()
			.then(vol => {
				if (vol) {
					vol.save({current_task: null}, {patch: true})
					.tap(() => {
						task.destroy()
					})
					.then(() => {
						vol.sendMessage({text: `${mentee.name} figured it out! I'm going to give you another task.`})
						return vol.getNewTask()
					})
				} else {
					return task.destroy()
				}
			})
			.then(() => {
				reply({text: "No problem, help cancelled!"})
			})
		}
	})
}

function assignMessage(payload, reply, args) {
	const admin = payload.sender.admin
	if (args.length < 1) {
		reply({text: "Must supply a task type!"})
		return
	}
	const taskType = args.shift()
	// TODO: verify that there is correct number of args for taskType
	if (args.length % 2 != 0) {
		reply({text: "Incorrect number of parameters."})
		return
	}
	const params = _.chunk(args, 2)
		.reduce((res, curr) => {
			var val = curr[1]
			if (!isNaN(val)) {
				val = parseInt(val, 10)
			}
			res[curr[0]] = val
			return res
		}, {})
	new Task({
		templateType: taskType,
		volunteer_fbid: null,
	}).query('where','instruction_params','@>', JSON.stringify(params)).fetch()
	.then((model) => {
		if (!model) {
			reply({text: "I could not find a matching task."})
			return
		} else {
			return Volunteer.fetchAll().then(volunteers => {
				const response = {
					"attachment":{
						"type":"template",
						"payload":{
							"template_type": "button",
							"text": `Who should I assign task #${model.id} to?`,
							"buttons": volunteers.map((v) => ({
								type:"postback", 
								title: v.name, 
								payload: JSON.stringify({
									type: "assign_task",
									args: {
										taskId: model.get('id'),
										volId: v.get('fbid'),
										adminId: admin.get('fbid')
									}
								})
							}))
						}
					}
			}
			reply(response)
		})
	}
})
}

function onboardVolunteer(payload, reply) {
  const response = {
	"attachment": {
	  "type":"template",
		"payload": {
		  "template_type": "button",
			  "text": `Hi! ${payload.sender.profile.first_name}, I am the LuzDeploy bot. To continue you must a) have an iOS device and b) complete the following consent form.`,
			  "buttons": [{
				type: "web_url",
				title: 'Open Consent Form', 
				url: `${config.BASE_URL}/consent.html?fbid=${payload.sender.id}`
			  }]
			}
		  }
	  }
	  reply(response)
}

function sendDeploymentMessage(fbid) {
  Deployment.collection().query('where', 'active', '=', true).fetch()
  .then(function(deployments) {
	if (deployments.length == 0) {
	bot.sendMessage(fbid, {
		text: "Hi! I am the LuzDeploy bot. We are launching on Thursday at 4pm in Gates-Hillman Center! I will reach out to you then with more information, and I hope you can help us out! (I will keep repeating this message, so contact Cole Gleason at m.me/coleagleason for more info.)"})
	} else {
	  const response = {
		  "attachment":{
			"type":"template",
			"payload":{
			  "template_type": "button",
			  "text": `Which deployment would you like to join?`,
			  "buttons": deployments.map((d) => ({
				type:"postback", 
				title: d.get('name'), 
				payload: JSON.stringify({
				  type: "join_deployment",
				  args: d.get('id'),
				})
			  }))
			}
		  }
	  }
	  bot.sendMessage(fbid, response)
	}
  })
}

module.exports.sendDeploymentMessage = sendDeploymentMessage;

function assignTask(payload, reply, args) {
	new Volunteer({fbid: args.volId}).fetch()
	.then(vol => {
		if (!vol)
		{
			reply({text: "Invalid volunteer."})
			return
		}
		new Task({id: args.taskId}).fetch()
			.then(task => {
				if (!task) {
					reply({text: "Invalid task."})
					 return
				} 
				task.save({volunteer_fbid: vol.get('fbid')}, {patch: true}).then(() => {
					new Admin({fbid: args.adminId}).fetch().then(admin => {
						admin.sendMessage({text: `Assigned task ${task.id} to ${vol.name}.`})
					})
				})
			})
	})
	// TODO: assign task based on id args
	// TODO: if already has assignedVol, then error
}

function joinDeployment(payload, reply, args) {
	Volunteer.where({fbid: payload.sender.id}).fetch({withRelated: ['deployment']}).then((vol) => {
		if (vol && vol.get('deploymentId')) {
			reply({text: `You are already in a deployment (${vol.related('deployment').get('name')}). You must leave that first.`})
		} else {
			const deployId = args
			Deployment.where({id: deployId}).fetch().then((deployment) => {
				if (!deployment) throw new Error(`invalid deployment id: ${deployId}`)
				let method = {method: 'insert'}
				if (vol)
					method = {method: 'update'}
				new Volunteer().save({
					fbid: payload.sender.id,
					deployment_id: deployment.get('id'),
					first_name: payload.sender.profile.first_name,
					last_name: payload.sender.profile.last_name
				}, method).then(function(vol) {
					reply({text: `Great! Welcome to the ${deployment.get('name')} deployment!`})
				})
			})
		}
	})
}

function startMessage(payload, reply) {
	const vol = payload.sender.volunteer
	vol.related('currentTask').fetch().then((task) => {
		if (!task) {
			reply({text: 'You don\'t have a task!'})
			return
		} else if (task.get('startTime')) {
			reply({text: 'This task has already been started!'})
			return
		} else {
			task.start().then((model) => {
				reply({text: `Task started at ${task.get('startTime')}.  Send 'done' when you have completed all of the steps.`})
			})
		}
	})
}

function askMessage(payload, reply) {
	// Get a task in the pool, and ask if he wants to do it.
	const vol = payload.sender.volunteer
	vol.related('deployment').fetch().then(deployment => {
	if (!deployment.isCasual) {
		reply({text: 'Sorry, you can\'t ask for a task in this deployment.'})
		return
	}
	if (vol.get('currentTask')) {
		reply({text: 'You already have a task! Finish that first.'})
		return
	}
	vol.getNewTask()
})
}

function rejectMessage(payload, reply) {
	const vol = payload.sender.volunteer
	vol.related('deployment').fetch().then(deployment => {
		if (!deployment.isCasual) {
			reply({text: 'Sorry, you can\'t reject a task in this deployment.'})
			return
		}
		if (!vol.get('currentTask')) {
			reply({text: 'You don\'t have a task.'})
			return
		}
		vol.unassignTask().then(() => reply({text: "Task rejected."}))
	})
}

function doneMessage(payload, reply) {
	const vol = payload.sender.volunteer
	vol.load(['deployment', 'currentTask']).then(vol => {
		const task = vol.related('currentTask')
		if (!task || !task.get('startTime')) {
			reply({text: "You don't have an active task."})
			return
		}

		const deployment = vol.related('deployment')
		// TODO (cgleason): double check this math works with ms conversion
		const xi =  task.estimatedTimeSec / task.elapsedTime
		let bestWeight = deployment.get('bestWeight')
		if (xi > bestWeight) {
			bestWeight = xi
		}
						
		// Dragans Cool Math
		const nVol = deployment.related('volunteers').count()
		const avgWeight = ((deployment.get('avgWeight')*(nVol - 1))/nVol) - xi/nVol
		const currWeight = (xi - (avgWeight/2)) / (bestWeight - (avgWeight/2));
		const newWeight = ((vol.get('weight'))*(1 - deployment.get('weightMultiplier'))) + currWeight*deployment.get('weightMultiplier');
		const subtract = (newWeight - vol.get('weight'))/(nVol - 1);
						
		//UPDATE WEIGHTS!
		const updates = deployment.related('volunteers').map((v) => {
			if (v.id != vol.id)
				return v.save({weight: v.get('weight') - subtract}, {patch: true})
			else
					return v.save({weight: newWeight, currentTask: null}, {patch: true})
		})
		updates.push(deployment.save({bestWeight: bestWeight, avgWeight: avgWeight}, {patch: true}))
		updates.push(task.finish())
		return Promise.all(updates)
		.then(deployment.isComplete.bind(deployment))
		.then((complete) => {
			if (complete) {
				deployment.finish()
			}
		})
		.then(deployment.getTaskPool.bind(deployment))
		.then((pool) => {
			if (pool.length > 0) {
				if (!deployment.isCasual) {
					vol.getNewTask()
				} else {
					reply({text: "You don't have any more tasks, but there are still some left for others."});
				}
			} else {
				reply({text: "No more tasks available right now."})
			}
		})
	})
}