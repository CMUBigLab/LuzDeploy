module.exports.buttonMessage = function(text, buttons) {
	var message =  {
		"attachment":{
			"type":"template",
			"payload":{
				"template_type": "button",
				"text": text,
				"buttons": buttons
			}
		}
	}
	return message;
}