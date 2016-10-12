let _ = require('lodash');

let Task = require('../models/task')
let TaskTemplate = require('../models/task-template')
let Volunteer = require('../models/volunteer')
let Deployment = require('../models/deployment')

module.exports.createVolunteer = function(deployment, id, firstName, lastName) {
	return new Volunteer().save({
		fbid: id,
		firstName: firstName,
		lastName: lastName,
		deploymentId: deployment.get('id'),
		consentDate: new Date()
	})
};

module.exports.createTask = function(deployment, options) {
	options = options || {}
	_.defaults(options, {deploymentId: deployment.get('id')})
	return new Task(options).save()
};

module.exports.createTaskTemplate = function(deployment, options) {
	options = options || {}
	_.defaults(options, {
		deploymentId: deployment.get('id'),
		instructions: {}
	})
	return new TaskTemplate().save(options, {method: 'insert'})
}

module.exports.createDeployment = function(options) {
	options = options || {}
	_.defaults(options, {name: "Test Deployment"})
	return new Deployment(options).save();
};