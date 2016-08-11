module.exports = {
	DB_CONFIG: {
		client: 'pg',
		connection: process.env.DATABASE_URL,
		debug: process.env.DEBUG
	}
}