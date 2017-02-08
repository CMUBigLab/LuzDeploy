if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is required.")
}
if (!process.env.HEROKU_APP_NAME) {
	throw new Error("HEROKU_APP_NAME is required.")
}

var threadId = process.env.HEROKU_APP_NAME == 'luzdeploy-staging' ?
	'1146606925407192': '720072294762496';

module.exports = {
	DB_CONFIG: {
		client: 'pg',
		connection: process.env.DATABASE_URL,
		debug: process.env.DEBUG
	},
	BASE_URL: `https://${process.env.HEROKU_APP_NAME}.herokuapp.com`,
	THREAD_URI: `fb-messenger://user/${threadId}`
}