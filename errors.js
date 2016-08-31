const util = require('util')

// Error thrown if attempting to insert a task with a
// template that doesn't exist.
function BadRequestError(message) {
	Error.captureStackTrace(this, this.constructor);
	this.name = this.constructor.name;
	this.message = message;
};
util.inherits(BadRequestError, Error);

module.exports.BadRequestError = BadRequestError;