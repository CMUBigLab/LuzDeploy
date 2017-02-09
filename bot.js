const Bot = require('messenger-bot')
const http = require('http')
const express = require('express')
const path = require('path');
const cli = require('./cli')
const handlers = require('./handlers')
const routes = require('./routes')
const Admin = require('./models/admin')
const errors = require('./errors')

process.env.PWD = process.cwd()

// TODO(cgleason): this file is a mess. Interactive mode should actually
// just talk to the real bot without all of this other nonsense

process.on('unhandledRejection', function(error, promise) {
	console.error("UNHANDLED REJECTION", error.stack);
	Admin.sendError(error).catch(err => console.log(`admin logging error ${err}`));
})

function expressErrorHandler(err, req, res, next) {
	// log error
	console.log(err);
	Admin.sendError(err);
	if (err instanceof errors.BadRequestError) {
		res.status(400).send({error: err.message});
	} else {
		res.status(500).end();
	}
}

module.exports.sendMessage = function(message) { return; };

if (require.main === module) {
	let bot = null
	if (cli.interactive) {
		bot = require('./interactive').instance
		module.exports.sendMessage = bot.sendMessage.bind(bot)
	} else {
		bot = new Bot({
			token: process.env.PAGE_ACCESS_TOKEN,
			verify: process.env.VERIFY_TOKEN,
			app_secret: process.env.APP_SECRET,
		})

		bot.on('error', (err) => {
			console.log(err.message)
		})

		let ignoring = {}

		bot.on('echo', (payload, reply) => {
			let msg = payload.message.text;
			console.log("echo received:", msg);
			if (msg && msg.startsWith('bot:')) {
				if (msg.slice(4) == "on") {
					delete ignoring[payload.recipient.id];
				} else if (msg.slice(4) == "off") {
					ignoring[payload.recipient.id] = true;
				} else {
					console.log(`invalid command ${msg}`);
				}
			}
			return;
		});

		bot.on('message', (payload, reply) => {
			if (ignoring[payload.sender.id]) {
				console.log(`ignoring message from ${payload.sender.id}`)
				return
			}

			bot.getProfile(payload.sender.id, (err, profile) => {
				console.log("message received", profile.first_name, profile.last_name);
				if (err) console.log(err)
				payload.sender.profile = profile
				if (payload.message.attachments) {
					handlers.dispatchAttachment(payload, reply)
					return
				} else if (!payload.message.text) {
					reply({text: "Sorry, I only handle text messages right now."})
					return
				} else {
					handlers.dispatchMessage(payload, reply);
					return
				}
			})
		})

		bot.on('postback',  (payload, reply) => {
			bot.getProfile(payload.sender.id, (err, profile) => {
				if (err) throw err
				payload.sender.profile = profile
				handlers.dispatchPostback(payload, reply)
			})
		})

		module.exports.sendMessage = function(fbid, payload, callback) {
			if (!callback) {
				callback = function(err, info) {
					if (err) console.log(err);
				}
			}
			bot.sendMessage(fbid, payload, callback)
		};
		module.exports.getProfile = bot.getProfile.bind(bot)

		bot.startListening = function() {
			var app = express()
			app.use(express.static(path.join(process.env.PWD, 'public')));
			app.use(routes)
			app.use(expressErrorHandler)
			app.use(bot.middleware())
			var server = app.listen(process.env.PORT || 3000, () => {
				console.log(`Echo bot server running at port ${server.address().port}.`)
			})
		}
	}

	bot.startListening()
}