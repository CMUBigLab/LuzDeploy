module.exports = {
	DB_CONFIG: {
		client: 'pg',
		connection: process.env.DATABASE_URL,
		debug: process.env.DEBUG
	},
	BASE_URL: `http://${process.env.HEROKU_APP_NAME}.herokuapp.com`
}