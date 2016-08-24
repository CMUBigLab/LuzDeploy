const Bot = require('messenger-bot')
const http = require('http')
const express = require('express')
var bodyParser = require('body-parser')

const cli = require('./cli')
const handlers = require('./handlers')
const consent = require('./consent')
process.on('unhandledRejection', function(error, promise) {
  console.error("UNHANDLED REJECTION", error.stack)
})

let bot = null
if (cli.interactive) {
  bot = require('./interactive').instance
  module.exports.sendMessage = bot.sendMessage.bind(bot)
} else {
  bot = new Bot({
    token: process.env.PAGE_ACCESS_TOKEN,
    verify: 'testbot_verify_token',
    app_secret: process.env.APP_SECRET,
  })

  bot.on('error', (err) => {
    console.log(err.message)
  })

  bot.on('message', (payload, reply) => {
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
      handlers.dispatchPostback (payload, reply)  
    })
  })

  module.exports.sendMessage = bot.sendMessage.bind(bot)
  bot.startListening = function() {
    var app = express()
    app.use(express.static(__dirname + '/static'))
    app.use(bodyParser.urlencoded())
    app.post('/consent', consent.post)
    app.use(bot.middleware())
    var server = app.listen(process.env.PORT || 3000, () => {
      console.log(`Echo bot server running at port ${server.address().port}.`)
    })
  }
}

bot.startListening()