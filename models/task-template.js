const bookshelf = require('../bookshelf')
const dust = require('dustjs-linkedin')

require('./deployment')
require('./base-model')
const TaskTemplate = bookshelf.model('BaseModel').extend({
  tableName: 'task_templates',
  idAttribute: 'type',
  deployment: function() {
    return this.belongsTo('Deployment')
  },
  renderInstructions: function(context) {
  	const promises = this.get('instructions').map((i) => {
        return new Promise((resolve, reject) => {
        	dust.renderSource(JSON.stringify(i.message), context, (err, out) => {
        		if (err) return reject(err)
        		i.message = JSON.parse(out)
          		return resolve(i)
        	})
        })
    })
  	return Promise.all(promises)
  },
})

module.exports = bookshelf.model('TaskTemplate', TaskTemplate)