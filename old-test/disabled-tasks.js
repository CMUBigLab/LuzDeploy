var chai = require('chai');
var sinon = require('sinon');
var chaiAsPromised = require("chai-as-promised");
var _ = require('lodash');
var Promise = require('bluebird');

var bot = require('../bot');
var testUtil = require('./util');

chai.use(chaiAsPromised);
chai.should();

describe('Deployment', function() {
	let deployment = null;
	let task_template = null;
	let john = null;
	before(function() {
		sinon.stub(bot, "sendMessage", function(message) {
			console.log(`sending message: ${message.text}`)
		});

		return testUtil.createDeployment().then(function(model) {
			deployment = model;
			return Promise.all([
				testUtil.createVolunteer(deployment, 2, "Jane", "Doe"),
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

	describe('#getTaskPool()', function() {
		let task = null;
		it('should not show disabled task', function() {
			after(function() {
				return task.destroy();
			});
			testUtil.createTask(
				deployment,
				{templateType: task_template.type, disabled: true}
			)
			.then(function(model) {
				task = model;
				deployment.getTaskPool().should.eventually.be.empty;
			});
		});
	});
});