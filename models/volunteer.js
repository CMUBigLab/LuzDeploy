const bookshelf = require('../bookshelf')
const bot = require('../bot')
const handlers = require('../handlers')

const Promise = require('bluebird')

const _ = require('lodash')
let msgUtil = require('../message-utils')

require('./deployment')
require('./task')
require('./base-model')
const Volunteer = bookshelf.model('BaseModel').extend({
	tableName: 'volunteers',
	idAttribute: 'fbid',
	currentTask: function() {
		return this.belongsTo('Task', 'current_task')
	},
	deployment: function() {
		return this.belongsTo('Deployment')
	},
	assignTask: function(task) {
		return Promise.all([
			this.save({currentTask: task.id}, {patch: true}),
			task.save({volunteer_fbid: this.id}, {patch: true})
		])
					// if (deployment.isCasual) {
					// 	let buttons = [{
					// 		type: "postback",
					// 		title: "Yes, accept task.",
					// 		payload: JSON.stringify({
					// 			type: "accept_task",
					// 			args: {}
					// 		})
					// 	},{
					// 		type: "postback",
					// 		title: "I can't do this now.",
					// 		payload: JSON.stringify({
					// 			type: "reject_task",
					// 			args: {}
					// 		})
					// 	}]
					// 	let text = `This task should take ${task.estimatedTimeMin} minutes. Do you have time to do it now?`
					// 	setTimeout(msgFn, (currWait+2)*1000, msgUtil.buttonMessage(text, buttons))
					// } else {
					// 	setTimeout(msgFn, (currWait+1)*1000, {text: `This task should take ${task.estimatedTimeMin} minutes. If you don't want to do the task, reply with 'reject'.`})
	},
	getNewTask: function() {
		return this.deployment().fetch()
		.then(deployment => {
			return [deployment, deployment.doesAnyoneNeedHelp(this)]
		})
		// if someone needs help, add mentorship task
		.spread((deployment, task) => {
			if (task) {
				return task
			} else {
				// otherwise, get normal task, looking for pre-assigned things
				return deployment.getTaskPool()
				.filter((task) => {
					if (task.get('templateType') == 'verify_beacon'){
						return task.getPlaceTask().then(placeTask => {
							if (!placeTask) {
								return true;
							} else {
								return placeTask.get('volunteerFbid') != this.get('fbid')
							}
						})
					} else {
						return true;
					}
				})
				.then(pool => {
					console.log("pool", pool);
					//pool = _.filter(pool, t => t.allowedToTake(this))
					const preAssigned = _.find(pool, p => {
						return p.get('volunteerFbid') == this.get('fbid')
					})
					if (preAssigned) {
						return preAssigned
					} else if (pool.length > 0) {
						return pool.pop()
					} else {
						return null
					}
				})
			}
		});
	},
	getAverageExpertise: function() {
		return bookshelf.model('Task').collection()
		.query('where', 'volunteer_fbid', '=', this.get('fbid'))
		.query('where', 'completed', '=', true)
		.query('where', 'score', 'is not', null).fetch()
		.then(tasks => {
			const total = _.sum(tasks.map(t => t.get('score')))
			return tasks.length ? total / tasks.length : 0
		})
	},
	getAverageTime: function() {
		return bookshelf.model('Task').collection()
		.query('where', 'volunteer_fbid', '=', this.get('fbid'))
		.query('where', 'completed', '=', true)
		.query('where', 'completed_time', 'is not', null)
		.query('where', 'start_time', 'is not', null)
		.fetch().then(tasks => {
			const total = _.sum(tasks.map(t => t.timeScore))
			return tasks.length ? total / tasks.length : 0
		})
	},
	completeTask: function() {
		return this.save({currentTask: null}, {patch: true})
	},
	unassignTask: function() {
		return this.currentTask().fetch()
		.then((task) => {
			return Promise.all([
				this.save({currentTask: null}, {patch: true}),
				task.save({volunteer_fbid: null, startTime: null, taskState: null}, {patch: true})
			])
		})
	},
	getMentorshipTask: function() {
		return bookshelf.model('Task').query(qb => {
			qb.where('template_type', '=', 'mentor')
			.andWhere('completed', '=', false)
			.andWhere('instruction_params','@>', {mentee: {fbid: this.get('fbid')}})
		})
		.fetch()
	},
	createMentorshipTask: function() {
		return this.currentTask().fetch().then(task => {
			if (!task) {
				throw new Error("There is no current task!")
			}
			let params = {mentee: this.serialize({shallow: true})}
			params.mentee.name = this.name
			if (task.get('instructionParams').beacon) {
				params.beacon = task.get('instructionParams').beacon
			} else {
				throw new Error("This task does not support mentorship yet.")
			}
			return bookshelf.model('Task').forge({
				templateType: 'mentor',
				instructionParams: params,
				deploymentId: this.get('deploymentId'),
				estimatedTime: '15 min',
			})
			.save()
		})
	},
	sendMessage: function(message) {
		bot.sendMessage(this.get('fbid'), message)
	},
	virtuals: {
		name: function() {
			return `${this.get('firstName')} ${this.get('lastName')}`
		}
	}
})

module.exports = bookshelf.model('Volunteer', Volunteer)