const Consent = require('./models/consent')

const handlers = require('./handlers')

module.exports.post = function(req, res) {
	new Consent().save({fbid: req.body.fbid, date: new Date()}).then(() => {
		res.send('<h1>Thanks! Please press the cancel button to return to the bot chat.</h1>')
		handlers.sendDeploymentMessage(req.body.fbid)
	})
}