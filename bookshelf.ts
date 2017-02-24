import * as pg from "pg";
import * as bookshelf from "bookshelf";
import * as knex from "knex";

import * as config from "./config";

pg.defaults.ssl = true;

const bs = bookshelf(knex(config.DB_CONFIG));
bs.plugin(["bookshelf-camelcase"]);
export = bs;