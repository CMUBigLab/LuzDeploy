const bot = require('./bot')
const TaskTemplate = require('./models/task-template')
const Volunteer = require('./models/volunteer')

const Task = require('./models/task')
var express = require('express');
var router = express.Router();
var bookshelf = require('./bookshelf')

const handlers = require('./handlers')
const _ = require('lodash')

router.post('/consent', function(req, res) {
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
		return new Volunteer(vol).save().then(() => {
			res.send('<h1>Thanks! Please press the cancel button to return to the bot chat.</h1>')
			handlers.sendDeploymentMessage(req.body.fbid)
		})
	})
})

router.post('/task', function(req, res) {
	new TaskTemplate({type: req.body.template_type}).fetch({require: true})
	.then(templateType => {
		const params = _.omit(req.body, ['template_type', 'deployment'])
		return new Task({
			instructionParams: JSON.stringify(params),
			estimatedTime: templateType.get('estimatedTime'),
			deployment_id: req.body.deployment,
			completedWebhook: templateType.get('completedWebhook'),
			template_type: req.body.template_type,
		}).save()
	})
	.then(result => {
		res.status(201).send(result.serialize())
	}).catch(bookshelf.NotFoundError, (err) => {
		res.status(400).send(`Invalid template type ${req.body.template_type}`)
	}).catch(err => { console.log(err); res.status(500).send(err) })
})

module.exports = router