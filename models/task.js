const request = require('request-promise')
const _ = require('lodash')
var Promise = require('bluebird')

var bot = require('../bot')

const bookshelf = require('../bookshelf')

require('./deployment')
require('./volunteer')
require('./task-template')
require('./base-model')

const Task = bookshelf.model('BaseModel').extend({
  tableName: 'tasks',
  deployment: function() {
    return this.belongsTo('Deployment')
  },
  assignedVolunteer: function() {
    return this.belongsTo('Volunteer', 'volunteer_fbid')
  },
  dependencies: function() {
    return this.belongsToMany('Task', 'dependencies', 'parent', 'child')
  },
  differentVolunteerSet: function() {
    return this.belongsToMany('Task', 'different_volunteer_tasks', 'task1_id', 'task2_id')
  },
  allowedToTake: function(vol) {
    return this.related(['differentVolunteerSet'])
    .where({volunteerFbid: vol.get('fbid')}).length == 0
  },
  template: function() {
    return this.belongsTo('TaskTemplate', 'template_type')
  },
  start: function() {
      return this.save({startTime: new Date()})
  },
  finish: function() {
    return this.assignedVolunteer().fetch().then(vol => {
      return Promise.all([
        this.save({completed: true, completedTime: new Date()}, {patch: true}),
        vol.save({currentTask: null}, {patch: true})
      ])
      .spread((task, vol) => {
        vol.sendMessage({text: `Thanks! You ended at ${task.get('completedTime')}.`})
        const webhook = this.get('completedWebhook')
        if (webhook) {
          return request.post({url: webhook, data: task.serialize({shallow: true})})
          .then((parsedBody) => {
            return Promise.resolve(task.set('score', parsedBody.score))
          }).catch((err) => {
            console.error(err)
          })
        }
      })
    })
  },
  renderInstructions: function(otherParams) {
    return this.load(['template']).then((task) => {
      let params = this.get('instructionParams')
      params = _.assign(params, otherParams)
          return task.related('template').renderInstructions(params)
    })
  },
  virtuals: {
    hasOutstandingDependancies: function() {
      return this.related('dependencies').filter((t) => !t.completed).length
    },
    estimatedTimeMin: function() {
      const int = _.defaults(this.get('estimatedTime'), {hours: 0, minutes: 0, seconds: 0})
      return int.hours * 60 + int.minutes + int.seconds / 60
    },
    estimatedTimeSec: function() {
      return this.estimatedTimeMin * 60
    },
    timeTakenSec: function() {
      return (this.get('completedTime').getTime() - this.get('startTime').getTime())/1000
    },
    timeScore: function() {
      return (this.estimatedTimeSec - this.timeTakenSec) / this.estimatedTimeSec
    }
  }
})

const DifferentVolunteerTasks = bookshelf.model('BaseModel').extend({
  tableName: 'different_volunteer_tasks',
  task1: function() {
    return this.belongsTo('Task', 'task1_id')
  },
  task2: function() {
    return this.belongsTo('Task', 'task2_id')
  },
})


bookshelf.model('DifferentVolunteerTasks', DifferentVolunteerTasks)
module.exports = bookshelf.model('Task', Task)

// task types:
// positioning beacons
// positioning checking
// fingerprint checking
// fingerprinting

// later moment:
// sweeping
// battery replacement