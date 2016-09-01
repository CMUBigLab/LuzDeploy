const bookshelf = require('../bookshelf')
const _ = require('lodash')

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
		.fetch({withRelated: ['dependencies']})
		.then((tasks) => {
			const freeTasks = tasks.filter((t) => {
				return !t.get('assignedVolunteer') && 
					   !t.get('completed') &&
					   !t.hasOutstandingDependancies
				})
			return freeTasks
		})
	},
	doesAnyoneNeedHelp: function() {
		return this.tasks()
		.query(function(qb) {
			qb.where({
				template_type: 'mentor', 
				volunteer_fbid: null,
				completed: false
			})
		}).fetchOne()
	},
	start: function() {
		return this.related('volunteers').fetchAll().then((volunteers) => {
			const updates = volunteers.map((v) => v.save({weight: 1/volunteers.length}))
			updates.push(this.save({startTime: new Date()}))
			return Promise.all(updates)
		})
	},
	finish: function() {
		return this.load(['volunteers']).then((d) => {
			d.related('volunteers').forEach((v) => {
				// TODO(cgleason): make survey into a button
				v.sendMessage({text: "Thank you very much!\nYou just helped by giving light to the visually impaired.\n\nI am still in research phase, please answer this survey so I can become better at helping.\n\nhttps://docs.google.com/forms/d/1hcwB18hnyniWFUQAQDm2MSMdlQQL4QYOG_Md9eFsQnE/viewform"})
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