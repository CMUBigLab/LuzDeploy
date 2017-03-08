import * as bookshelf from "bookshelf";
import * as knex from "knex";
import * as pg from "pg";

pg.defaults.ssl = true;

import knexfile = require("./knexfile");

const dbConfig = knexfile[process.env.NODE_ENV];

const bs = bookshelf(knex(dbConfig));
bs.plugin("bookshelf-camelcase");
export = bs;