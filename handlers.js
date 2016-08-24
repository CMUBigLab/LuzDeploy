const Deployment = require('./models/deployment')
const Volunteer = require('./models/volunteer')
const Admin = require('./models/admin')
const Task = require('./models/task')
const constants = require('./constants')

const _ = require('lodash')
const config = require('./config')

const messageHandlers = {
	'hello': {
		handler: greetingMessage,
	},
	'kitten': {
		handler: kittenMessage,
	},
	'done': {
		handler: doneMessage,
	},
	'start': {
		handler: startMessage,
	},
	'ask': {
		handler: askMessage,
	},
	'reject': {
		handler: rejectMessage,
	},
	'help': {
		handler: helpMessage,
	},
  'assign': {
    handler: assignMessage,
    adminRequired: true,
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
  }
}

const aliases = {
	'd': 'done',
	'r': 'reject',
	's': 'start',
	'a': 'ask',
	'h': 'help',
	'hi': 'hello',
	'hey': 'hello',
}

module.exports.dispatchMessage = (payload, reply) => {
  Admin.where({fbid: payload.sender.id}).fetch()
  .then(admin => {
    if (admin) {
      payload.sender.admin = admin
    }
    return Volunteer.where({fbid: payload.sender.id}).fetch()
  })
  .then(vol => {
    if (!vol) {
      onboardVolunteer(payload, reply)
      return
    }
    payload.sender.volunteer = vol
  })
  .then(() => {
    if (!payload.sender.admin || !payload.sender.volunteer) {
      return
    }
    if (!payload.message.text) {
      reply({text: "Sorry, I only handle text messages right now."})
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
      .then(() => {
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

function helpMessage(payload, reply) {
  const vol = payload.sender.volunteer
  vol.related('deployment').fetch().then(d => d.sendMentor(vol))
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
              "text": `Hi! ${payload.sender.profile.first_name}, I am the luzDeploy bot. To continue you must a) have an iOS and b) complete the following consent form.`,
              "buttons": [{
                type: "web_url",
                title: 'Open Consent Form', 
                url: `${config.BASE_URL}/consent.html`
              }]
            }
          }
      }
      reply(response)
}

function sendDeploymentMessage(payload, reply) {
  Deployment.fetchAll().then(function(deployments) {
    if (deployments.count() == 0) {
      reply({text: `Hi! ${payload.sender.profile.first_name}, I am the luzDeploy bot. 
        We don't have any deployments right now, so please check back later!`})
    } else {
      const response = {
          "attachment":{
            "type":"template",
            "payload":{
              "template_type": "button",
              "text": `Hi! ${payload.sender.profile.first_name}, I am the luzDeploy bot. Which deployment would you like to join?`,
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
      reply(response)
    }
  })
}

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
    if (vol && vol.related('deployment')) {
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

function kittenMessage(payload, reply) {
    reply({
        "attachment": {
            "type": "image",
            "payload": {
                "url": "http://thecatapi.com/api/images/get?format=src&type=png&size=med"
            },
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
        reply({text: `Task started at ${task.get('startTime')}.`})
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
    vol.rejectTask().then(() => reply({text: "Task rejected."}))
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
      } else {
        deployment.checkThresholds()
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