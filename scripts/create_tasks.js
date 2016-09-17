const TaskTemplate = require('../models/task-template')
const Task = require('../models/task')

const DEPLOYMENT = 2

var fs = require("fs")
var Promise = require('bluebird')
var readDir = Promise.promisify(fs.readdir)
var readFile = Promise.promisify(fs.readFile)

readDir('./task_data/').then(files =>
	Promise.map(files, name => {
		return readFile(`./task_data/${name}`, 'utf8')
		//.bind({a: "1"})
		.then(c => JSON.parse(c))
		.bind({a: "1"})
		.then(function(data) {
			this.taskData = data
			return readFile(`./task_templates/${data.task}.json`)
		})
		.then(file => JSON.parse(file))
		.then(function(template) {
			this.template = template
			return new TaskTemplate({type: template.type}).fetch()
		})
		.then(function(model) {
			const options = {method: "insert"}
			if (model) {
				options.method = "update"
			}
			return new TaskTemplate({
				type: this.template.type,
				deployment_id: DEPLOYMENT,
				instructions: JSON.stringify(this.template.instructions),
			}).save(null, options)
		})
		.then(function(taskTemplate) {
			console.log(`Saved template ${taskTemplate.id}`)
			return Promise.map(this.taskData.list, params => {
				return new Task({
					instructionParams: JSON.stringify(params),
					estimatedTime: this.template.estimated_time,
					deployment_id: DEPLOYMENT,
					completedWebhook: this.template.completed_webhook,
					template_type: taskTemplate.id,
				}).save()
				.then(task => {
					console.log(`Saved task ${task.id}`)
				})
			})
		})
	})
).then(() => process.exit())
.catch(err => { 
	console.log(err)
	process.exit(1)
})