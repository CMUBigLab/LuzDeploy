const Bot = require('messenger-bot')
const http = require('http')
const express = require('express')
var bodyParser = require('body-parser')

const cli = require('./cli')
const handlers = require('./handlers')
const routes = require('./routes')
process.on('unhandledRejection', function(error, promise) {
  console.error("UNHANDLED REJECTION", error.stack)
})
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

  bot.on('message', (payload, reply) => {
    if (!payload.message.text) {
      reply({text: "Sorry, I only handle text messages right now."})
      return
    }
    bot.getProfile(payload.sender.id, (err, profile) => {
      if (err) throw err
      payload.sender.profile = profile
      handlers.dispatchMessage(payload, reply)  
    })
  })

  bot.on('postback',  (payload, reply) => {
    bot.getProfile(payload.sender.id, (err, profile) => {
      if (err) throw err
      payload.sender.profile = profile
      handlers.dispatchPostback(payload, reply)
    })
  })

  module.exports.sendMessage = bot.sendMessage.bind(bot)
  module.exports.getProfile = bot.getProfile.bind(bot)

  bot.startListening = function() {
    var app = express()
    app.use(express.static(__dirname + '/static'))
    app.use(bodyParser.urlencoded({extended: true}))
    app.use(routes)
    app.use(bot.middleware())
    var server = app.listen(process.env.PORT || 3000, () => {
      console.log(`Echo bot server running at port ${server.address().port}.`)
    })
  }
}


bot.startListening()
}