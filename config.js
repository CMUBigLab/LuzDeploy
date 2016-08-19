module.exports = {
	DB_CONFIG: {
		client: 'pg',
		connection: process.env.DATABASE_URL,
		debug: process.env.DEBUG
	},
	BASE_URL: "http://infinite-hamlet-59231.herokuapp.com/"
}