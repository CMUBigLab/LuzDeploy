const bookshelf = require('../bookshelf')
const _ = require('lodash')
const msgUtil = require('../message-utils')
var Promise = require('bluebird')

require('./volunteer')
require('./task')
require('./base-model')
const Deployment = bookshelf.model('BaseModel').extend({
	tableName: 'deployments',
	volunteers: function() {
		return this.hasMany('Volunteer')
	},
	tasks: function() {
		return this.hasMany('Task')
	},
	distributeTasks: function() {
		return this.volunteers()
		.query({where: {currentTask: null}})
		.fetch()
		.then(volunteers => {
			volunteers.forEach((v) => v.getNewTask())
		})
	},
	getTaskPool: function() {
		return this.tasks()
		.query({where:{completed: false, volunteer_fbid: null, disabled: false}})
		.fetch()
		.then(function(pool) {
			return pool.sortBy(function(task) {
				return [task.get('templateType'), Number(task.get('instructionParams').edge)];
			});
		})
		.then(tasks => tasks.models);
		// .then(tasks => {
		// 	return Promise.filter(
		// 		tasks.models,
		// 		t => t.hasOutstandingDependancies().then(r => !r)
		// 		)
		// })
	},
	doesAnyoneNeedHelp: function(mentor) {
		return this.tasks()
		.query(function(qb) {
			qb.where({
				template_type: 'mentor', 
				volunteer_fbid: null,
				completed: false
			})
			.andWhereNot('instruction_params','@>', {mentee: {fbid: mentor.get('fbid')}})
		}).fetchOne()
	},
	checkThresholds: function() {
		return this.volunteers().fetch({withRelated: ['currentTask']})
		.then(function(volunteers) {
			volunteers.forEach(v => {
				if (v.get('currentTask') && v.get('startTime') && !v.get('completed')) {
					if (v.currentTask().timeScore < 0 && v.currentTask().timeScore > -1) {
						let text = "You didn't finish your task in the estimated thim period. Do you need help?"
						let buttons = [{type: "postback", title: "Yes, please send someone.", payload:"{\"type\":\"send_mentor\",\"args\":{}}"}]
						v.sendMessage(msgUtil.buttonMessage(text, buttons))
					} else if (v.currentTask().timeScore < -1) {
						v.sendMessage({text: "You haven't finished your task in more that twice the estimated time it would take. We are going to send someone to help you."})
						return v.createMentorshipTask()
					}
				}
			})
		})
	},
	start: function() {
		return this.save({startTime: new Date(), active: true})
	},
	sendSurvey: function(vol) {
		let buttons = [{
			type: "web_url",
			url: `https://docs.google.com/forms/d/e/1FAIpQLSfkJZb1GOGR1HfC8zw2nipkl3yi_-7cDbUNvigl2PjqLxhbqw/viewform?entry.2036103825=${vol.get('fbid')}`,
			title: "Open Survey"
		}]
		let text = "I am work-in-progress, so please help me become a better bot by answering this quick survey!"
		return vol.sendMessage(msgUtil.buttonMessage(text, buttons))
	},
	finish: function() {
		return this.volunteers().fetch().then(volunteers => {
			volunteers.forEach((v) => {
				v.sendMessage({text: "Thank you very much!\nYou just helped make CMU accessible."})
				this.sendSurvey(v)
			})
			return this.save({doneTime: new Date()})
		})
	},
	isComplete: function() {
		return this.tasks()
		.query({where: {completed: false}}).count()
		.then(count => count == 0)
	},
	virtuals: {
		isCasual: function() {
			const type = this.get('type')
			return type == 'casual' || type == 'semiCasual'
		}
	}
})

module.exports = bookshelf.model('Deployment', Deployment)