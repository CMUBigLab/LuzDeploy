const request = require('request-promise')
const _ = require('lodash')

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
  template: function() {
    return this.belongsTo('TaskTemplate', 'template_type')
  },
  start: function() {
      return this.save({startTime: new Date()})
  },
  finish: function() {
      return this.save({completed: true, completedTime: new Date()}, {patch: true})
      .then(() => {
        this.assignedVolunteer().sendMessage({text: `Thanks! You ended at ${this.get('completedTime')}.`})
      })
      .then(() => {
        const webhook = this.get('completedWebhook')
        if (webhook) {
          return request.post({url: webhook, data: this.serialize({shallow: true})})
          .then((parsedBody) => {
            return Promise.resolve(this.set('score', parsedBody.score))
          }).catch((err) => {
            console.error(err)
          })
        }
      })
  },
  renderInstructions: function(otherParams) {
    return this.load(['template']).then((task) => {
      const params = this.get('instructionParams')
      _.assign(params, otherParams)
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
    }
  }
})

module.exports = bookshelf.model('Task', Task)

// task types:
// positioning beacons
// positioning checking
// fingerprint checking
// fingerprinting

// later moment:
// sweeping
// battery replacement