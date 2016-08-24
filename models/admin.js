const bookshelf = require('../bookshelf')
const bot = require('../bot')

require('./deployment')
require('./base-model')
const Admin = bookshelf.model('BaseModel').extend({
  tableName: 'admins',
  idAttribute: 'fbid',
  deployments: function() {
    return this.belongsToMany('Deployment')
  },
  sendMessage: function(message) {
  	return bot.sendMessage(this.get('fbid'), message)
  }
})

module.exports = bookshelf.model('Admin', Admin)