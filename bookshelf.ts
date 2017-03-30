import * as bookshelf from "bookshelf";
import * as knex from "knex";
import * as pg from "pg";

pg.defaults.ssl = true;

import knexfile = require("./knexfile");

const dbConfig = knexfile[process.env.NODE_ENV];

export = bookshelf(knex(dbConfig));