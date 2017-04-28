// Update with your config settings.

export = {

  test: {
    client: "sqlite3",
    connection: {
      filename: ":memory:"
    }
  },

  development: {
    client: "sqlite3",
    debug: true,
    connection: {
      filename: ":memory:"
    }
  },

  staging: {
    client: "postgresql",
    connection: process.env.DATABASE_URL,
    ssl: true,
    debug: true,
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      tableName: "knex_migrations"
    }
  },

  production: {
    client: "postgresql",
    connection: process.env.DATABASE_URL,
    ssl: true,
    debug: true,
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      tableName: "knex_migrations"
    }
  }

};
