module.exports.buttonMessage = function(text, buttons, quick_replies) {
	quick_replies = quick_replies || []
	return {
		"quick_replies": quick_replies,
		"attachment":{
			"type":"template",
			"payload":{
				"template_type": "button",
				"text": text,
				"buttons": buttons
			}
		}
	}
}