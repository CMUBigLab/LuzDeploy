const Consent = require('./models/consent')

var express = require('express');
var router = express.Router();

const handlers = require('./handlers')

router.post('/consent', function(req, res) {
	new Consent().save({fbid: req.body.fbid, date: new Date()}).then(() => {
		res.send('<h1>Thanks! Please press the cancel button to return to the bot chat.</h1>')
		handlers.sendDeploymentMessage(req.body.fbid)
	})
})

router.post('/task', function(req, res) {
	new TemplateType({type: req.body.template_type}).fetch({require: true})
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
		res.send(result, 201)
	}).catch(NotFoundError, (err) => {
		res.send(`Invalid template type ${req.body.template_type}`, 400)
	})
})

module.exports = router