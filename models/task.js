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
      return this.save({startTime: new Date()}, {patch: true})
      // TODO: extract following code into specific task controller
/*      .tap(task => {
        if (task.get('templateType') == 'mentor') {
          bot.sendMessage(
            task.get('instructionParams').mentee.fbid,
            {text: `You asked for help, so ${task.assignedVolunteer().name} is coming to help you at your task location.`}
          )
        }
      })*/
  },
  finish: function() {
    return this.save({completed: true, completedTime: new Date()}, {patch: true});

// TODO: extract into task controller
/*        const webhook = this.get('completedWebhook')
        if (webhook) {
          return request.post({url: webhook, data: task.serialize({shallow: true})})
          .then((parsedBody) => {
            return Promise.resolve(task.set('score', parsedBody.score))
          }).catch((err) => {
            console.error(err)
          })
        }*/
  },
  renderInstructions: function(otherParams) {
    return this.load(['template']).then((task) => {
      let params = this.get('instructionParams')
      params = _.assign(params, otherParams)
          return task.related('template').renderInstructions(params)
    })
  },
  hasOutstandingDependancies: function() {
      return this.dependencies()
      .query('where', 'completed', '=', false)
      .fetch()
      .then(d => (d.length > 0))
  },
  getPlaceTask: function() {
    return bookshelf.model('Task').forge({
      deploymentId: this.get('deploymentId'),
      templateType: 'place_beacon',
    }).query((qb) => {
      qb.where('instruction_params', '=', this.get('instructionParams'))
    }).fetch()
  },
  saveState: function() {
    var taskState = this.__machina__;
    if (this.context) {
      taskState.context = this.context;
    }
    return this.save({taskState}, {patch: true})
  },
  loadState: function() {
    var state = this.get('taskState');
    if (state.context) {
      this.context = state.context;
      delete state.context;
    }
    this.__machina__ = state;
  },
  virtuals: {
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