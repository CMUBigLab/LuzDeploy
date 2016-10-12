var chai = require('chai');
var sinon = require('sinon');
var chaiAsPromised = require("chai-as-promised");
var _ = require('lodash');
var Promise = require('bluebird');

var bot = require('../bot');
var testUtil = require('./util');

chai.use(chaiAsPromised);
chai.should();

function createUniqueTaskSet(deployment, tasks) {
	return Promise.all(_.map(tasks, t => testUtil.createTask(deployment, t)))
	.then(models => {
		let updates = _.map(models, m => {
			let otherIds = _(models).map('id').without(m.id).value()
			return m.differentVolunteerSet().attach(otherIds)
		})
		return Promise.all(updates).then(a => { return models })
	})
}

describe('Task', function() {
	let john = null;
	let task_template = null;
	let deployment = null;
	before(function() {
		sinon.stub(bot, "sendMessage", function(message) {
			console.log(`sending message: ${message.text}`)
		});

		return testUtil.createDeployment().then(function(model) {
			deployment = model;
			return Promise.all([
				testUtil.createVolunteer(deployment, 1, "John", "Smith"),
				testUtil.createTaskTemplate(deployment, {type: "sweep"})
			]);
		})
		.spread(function(vol, template) {
			john = vol;
			task_template = template;
		});
	})

	after(function() {
		bot.sendMessage.restore();
		return Promise.all([
			john.destroy(), task_template.destroy()
		])
		.then(function() {
			return deployment.destory();
		});
	})

	describe('#allowedToTake()', function() {
		it('should not allow volunteer to take task', function() {
			createUniqueTaskSet(
				deployment,
				[
					{templateType: task_template.get('type')},
					{templateType: task_template.get('type')},
				]
			).then(function(models) {
				let taskA = models[0], taskB = models[1];
				taskA.allowedToTake(john).should.be.true;
				taskB.allowedToTake(john).should.be.true;

				john.assignTask(taskA)
				.then(function(models) {
					let task = models[1];
					return task.start();
				})
				.then(function(startedTask) {
					return startedTask.finish();
				}).then(function() {
					taskB.allowedToTake(john).should.be.false;
				});
			});
			});
		});	
	});