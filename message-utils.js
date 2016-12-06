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

module.exports.quickReplyMessage = function(text, quickReplies) {
	var message = {
		text: text,
		quick_replies: quickReplies,
	}
	return message;1
}