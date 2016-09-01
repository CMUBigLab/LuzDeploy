const bookshelf = require('../bookshelf')
const _ = require('lodash')
const msgUtil = require('../message-utils')

require('./volunteer')
require('./task')
require('./base-model')
const Deployment = bookshelf.model('BaseModel').extend({
	//averageWeight: 1,
	//bestWeight: 0,
	//warnThreshold: 1/2, // TODO (cgleason): fix these thresholds
	//askThreshold: 1/3,
	//sendThreshold: 1/4,
	//roundRobinInterval: 1 * constants.MS_IN_MIN,
	//type:'event', // casual, semi-casual, event
	//lat: null,
	//long: null,
	//weightMultiplier
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
		.query({where:{completed: false, volunteer_fbid: null}})
		.fetch({withRelated: ['dependencies']})
		.then((tasks) => {
			const freeTasks = tasks.filter((t) => {
				return !t.hasOutstandingDependancies
				})
			return freeTasks
		})
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
	finish: function() {
		return this.volunteers().fetch().then(volunteers => {
			volunteers.forEach((v) => {
				let buttons = [{
					type: "web_url",
					url: "https://docs.google.com/forms/d/1hcwB18hnyniWFUQAQDm2MSMdlQQL4QYOG_Md9eFsQnE/viewform",
					title: "Open Survey"
				}]
				let text = "Thank you very much!\nYou just helped make CMU accessible.\n\nI am still in the research phase, so please answer this survey so I can become better!"
				v.sendMessage(msgUtil.buttonMessage(text, buttons))
			})
			return this.save({doneTime: new Date()})
		})
	},
	isComplete: function() {
		return this.tasks()
		.query({where: {completed: false}}).count()
		.tap(console.log)
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