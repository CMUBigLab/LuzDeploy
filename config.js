if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is required.")
}
if (!process.env.HEROKU_APP_NAME) {
	throw new Error("HEROKU_APP_NAME is required.")
}

module.exports = {
	DB_CONFIG: {
		client: 'pg',
		connection: process.env.DATABASE_URL,
		debug: process.env.DEBUG
	},
	BASE_URL: `http://${process.env.HEROKU_APP_NAME}.herokuapp.com`
}