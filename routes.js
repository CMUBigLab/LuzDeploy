var express = require('express');
const _ = require('lodash')
var bodyParser = require('body-parser')

var bookshelf = require('./bookshelf')
const bot = require('./bot')
const errors = require('./errors')
const handlers = require('./handlers')

const TaskTemplate = require('./models/task-template')
const Volunteer = require('./models/volunteer')
const Task = require('./models/task')
const Admin = require('./models/admin')

var router = express.Router();

// Creates a new volunteer.
router.post('/consent', bodyParser.urlencoded({extended: true}), function(req, res, next) {
	const vol = {
		fbid: req.body.fbid,
		consentDate: new Date(),
	}
	bot.getProfile(req.body.fbid, (err, profile) => {
		if (!err) {
			vol.firstName = profile.first_name
			vol.lastName = profile.last_name
		} else {
			console.log(err)
		}
		return new Volunteer().save(vol).then(() => {
			res.send('<h1>Thanks! Please press the cancel button to return to the bot chat.</h1>')
			handlers.sendDeploymentMessage(req.body.fbid)
		})
		.catch(next)
	})
})

// Batch add tasks.
router.post('/tasks', bodyParser.json(), function(req, res, next) {
	let templates = _.map(req.body, 'template_type')
	TaskTemplate.collection()
	.query('where', 'type', 'in', templates)
	.fetch()
	.then(function(models) {
		return models.reduce((acc, t) => {
			acc[t.get('type')] = t
			return acc
		}, {})
	})
	.then(function(templates) {
		let ps = req.body.map(function(task) {
			if (!(task.template_type in templates)) {
				throw new errors.BadRequestError(`No template named ${task.get('templateType')}`)
			}
			let template = templates[task.template_type]
			const params = _.omit(task
				['template_type', 'deployment_id', 'dependencies']
			)
			return new Task({
				instructionParams: JSON.stringify(params),
				estimatedTime: template.get('estimatedTime'),
				deployment_id: task.deployment_id,
				completedWebhook: template.get('completedWebhook'),
				template_type: task.template_type,
			}).save()
		})
		return Promise.all(ps)
	})
	.then(results => {
		res.status(201).send(results.map(r => r.serialize()))
	})
	.catch(next)
})

module.exports = router