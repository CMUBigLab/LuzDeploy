const Consent = require('./models/consent')
const TaskTemplate = require('./models/task-template')

const Task = require('./models/task')
var express = require('express');
var router = express.Router();
var bookshelf = require('./bookshelf')

const handlers = require('./handlers')

router.post('/consent', function(req, res) {
	new Consent().save({fbid: req.body.fbid, date: new Date()}).then(() => {
		res.send('<h1>Thanks! Please press the cancel button to return to the bot chat.</h1>')
		handlers.sendDeploymentMessage(req.body.fbid)
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
	.then((result) => {
		res.status(201).send(result)
	}).catch(bookshelf.NotFoundError, (err) => {
		res.status(400).send(`Invalid template type ${req.body.template_type}`)
	}).catch((e) => res.status(500).send(e))
})

module.exports = router