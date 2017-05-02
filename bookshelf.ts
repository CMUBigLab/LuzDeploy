import * as bookshelf from "bookshelf";
import * as knex from "knex";
import * as pg from "pg";

pg.defaults.ssl = true;

// Fix for parsing of numeric fields
pg.types.setTypeParser(1700, "text", parseFloat);

import knexfile = require("./knexfile");

const dbConfig = knexfile[process.env.NODE_ENV];

export = bookshelf(knex(dbConfig));