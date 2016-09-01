module.exports.createMentorshipTask = function(mentor, mentee) {
	return Task.forge({
		templateType: 'mentor',
		instructionParams: {
			mentor: mentor.serialize(),
			mentee: mentee.serialize(),
		},
		deployment: mentor.get('deploymentId')
	}).save()
}