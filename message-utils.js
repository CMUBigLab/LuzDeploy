module.exports.buttonMessage = function(text, buttons, quick_replies) {
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
	if (quick_replies) {
		message['quick_replies'] = quick_replies;
	}
	return message;
}