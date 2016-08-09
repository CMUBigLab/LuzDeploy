const bookshelf = require('../bookshelf')
const bot = require('../bot')
const handlers = require('../handlers')

require('./deployment')
require('./task')
const Volunteer = bookshelf.Model.extend({
	tableName: 'volunteers',
	idAttribute: 'fbid',
	// fbid
	// name
	// weight
	// currentTask
	// deployment
	currentTask: function() {
		return this.belongsTo('Task', 'currentTask')
	},
	deployment: function() {
		return this.belongsTo('Deployment')
	},
	assignTask: function(task) {
  		return Promise.all([
  			this.save({currentTask: task.id}),
  			task.save({volunteer_fbid: this.id})
  		])
  		.then(() => {
  			//bot.sendMessage(ids.carlId, {text: "Vol id: ${vol.id} task: ${JSON.stringify(t)}"})
  			this.sendMessage({text: `Your task should take ${task.estimatedTimeMin} minutes.`})
  			handlers.sendInstructions(this.currentTask.type, this)
  		})
	},
	rejectTask: function() {
		const task = this.related('currentTask')
		return Promise.all([
			this.save({currentTask: null}),
			task.save({volunteer_fbid: null, startTime: null}, {patch: true})
		])
	},
	sendMessage: function(message) {
		bot.sendMessage(this.get('fbid'), message)
	}
})

module.exports = bookshelf.model('Volunteer', Volunteer)