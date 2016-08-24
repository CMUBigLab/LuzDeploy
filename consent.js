const Consent = require('./models/consent')

const handlers = require('./handlers')

module.exports.post = function(req, res) {
	new Consent({fbid: req.body.fbid, date: new Date()}).save().then(() => {
		res.send('Thanks! Please press the back button.')
		handlers.sendDeploymentMessage(fbid)
	})
}