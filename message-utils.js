module.exports.buttonMessage = function(text, buttons) {
	return {
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