const fs = require("fs")
const TaskTemplate = require('../models/task-template')
const Task = require('../models/task')

const DEPLOYMENT = 1

fs.readdir('./task_data/', (err, files) => {
	if (err) throw err
	const taskData = files.map(
		name => JSON.parse(fs.readFileSync(`./task_data/${name}`, 'utf8'))
	)
	taskData.forEach(data => {
		fs.readFile(`./task_templates/${data.task}.json`, (err, file) => {
			if (err) throw err
			const template = JSON.parse(file)
			const taskTemplate = {
				type: template.type,
				deployment_id: DEPLOYMENT,
				instructions: JSON.stringify(template.instructions),
			}
			new TaskTemplate({type: template.type}).fetch()
			.then(model => {
				const options = {method: "insert"}
				if (model) {
					options.method = "update"
				}
				return options
			})
			.then((options) => {
				new TaskTemplate(taskTemplate).save(null, options).then((taskTemplate) => {
					console.log(`Saved template ${taskTemplate.id}`)
					data.list.forEach(params => {
						const task = {
							instructionParams: JSON.stringify(params),
							estimatedTime: template.estimated_time,
							deployment_id: DEPLOYMENT,
							completedWebhook: template.completed_webhook,
							template_type: taskTemplate.id,
						}
						new Task(task).save().then(task => {
							console.log(`Saved task ${task.id}`)
						})
					})
				})
			})
		})
	})
})