import * as bookshelf from "bookshelf";
import * as knex from "knex";

import knexfile = require("./knexfile");

const dbConfig = knexfile[process.env.NODE_ENV];

const bs = bookshelf(knex(dbConfig));
bs.plugin("bookshelf-camelcase");
export = bs;