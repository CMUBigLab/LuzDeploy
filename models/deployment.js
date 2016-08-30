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
		return this.getTaskPool().then(pool => {
			this.related('volunteers')
				.filter((v) => !v.currentTask)
				.forEach((v) => {
    				if (pool.length > 0 && v.canDoTask(pool[0])) {
     					v.assignTask(pool.pop())
    			}
			})
		})
	},
	sendMentor: function(mentee) {
		this.related('volunteers').fetch().then((vols) => {
			vols.remove(mentee)
			const mentor = vols.reduce((prev, current) => {
				return (prev.weight > current.weight) ? prev : current
			})
  			// send message to mentee
  			mentee.sendMessage({text: `We are sending ${mentor.name} to help you.`})
  			// send message to mentor
  			mentor.sendMessage({text: `Go help volunteer ${mentee.name}`})
  		})
	},
	getTaskPool: function() {
    return this.tasks()
    .fetch({withRelated: ['dependencies', 'differentVolunteerSet']})
    .then((tasks) => {
    	const freeTasks = tasks.filter((t) => {
    		return !t.get('assignedVolunteer') && 
    			     !t.get('completed') && 
    			     !t.hasOutstandingDependancies
    		})
    	return freeTasks
    })
  },
  checkThresholds: function() {
  	return this.related('volunteers').fetch().then((volunteers) => {
  		volunteers.forEach((v) => {
      	if (v.get('weight') < this.get('sendHelpThreshold')) {
    			this.sendMentor(v)
  			} else if (v.get('weight') < this.get('askThreshold')) {
    			v.sendMessage({text: "Do you want help? If so do..."})
  			} else if (v.get('weight') < this.get('warningThreshold')) {
    			v.sendMessage({text: "You are lagging behind"})
  			}
      })
  	})
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
      .query('where', 'completed', '=', 'false')
      .count()
      .then(count => {
        console.log(count)
        return count == 0
      })
    },
	virtuals: {
		isCasual: function() {
			const type = this.get('type')
			return type == 'casual' || type == 'semiCasual'
		}
	}
})

module.exports = bookshelf.model('Deployment', Deployment)