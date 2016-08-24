const Consent = require('./models/consent')

const handlers = require('./handlers')

module.exports.post = function(req, res) {
	console.log(req.body.fbid)
	new Consent().save({fbid: req.body.fbid, date: new Date()}).then(() => {
		res.send('Thanks! Please press the back button.')
		handlers.sendDeploymentMessage(fbid)
	})
}