var chai = require('chai');
var sinon = require('sinon');
var chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);
chai.should();


let Task = require('../models/task')
let Volunteer = require('../models/volunteer')

let bot = require('../bot')

let _ = require('lodash')

function createVolunteer(id, firstName, lastName) {
	return new Volunteer().save({
		fbid: 1,
		firstName: firstName,
		lastName: lastName,
		deploymentId: 1,
		consentDate: new Date()
	})
}

function createTask(task) {
	_.defaults(task, {deploymentId: 1})
	return new Task().save(task)
}

function createUniqueTaskSet(tasks) {
	return Promise.all(_.map(tasks, t => createTask(t)))
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
	before(function() {
		sinon.stub(bot, "sendMessage", function(message) {
			console.log(`sending message: ${message.text}`)
		});

		return createVolunteer(1, "John", "Smith")
		.then(function(vol) { john = vol; });

	})

	after(function() {
		return john.destroy();
	})

	describe('#allowedToTake()', function() {
		it('should not allow volunteer to take task', function() {
			createUniqueTaskSet([
				{templateType: 'sweep'},
				{templateType: 'sweep'},
			]).then(function(models) {
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