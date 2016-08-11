const bookshelf = require('../bookshelf')
const dust = require('dustjs-linkedin')
const Promise = require("bluebird")

require('./deployment')
require('./base-model')
const TaskTemplate = bookshelf.model('BaseModel').extend({
  tableName: 'task_templates',
  idAttribute: 'type',
  deployment: function() {
    return this.belongsTo('Deployment')
  },
  renderInstructions: function(context) {
  	return new Promise.map(this.get('instructions'), (i) => {
        return new Promise((resolve, reject) => {
        	dust.renderSource(JSON.stringify(i.message), context, (err, out) => {
        		if (err) return reject(err)
        		i.message = JSON.parse(out)
          		return resolve(i)
        	})
        })
      })
  },
})

module.exports = bookshelf.model('TaskTemplate', TaskTemplate)