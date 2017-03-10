import { BaseModel } from "./base";
import * as FBTypes from "facebook-sendapi-types";
import * as logger from "winston";
import * as knex from "knex";

import bookshelf = require("../bookshelf");
import {bot} from "../bot";
import {Deployment} from "./deployment";

const TABLE_NAME = "admins";
const ID_ATTRIBUTE = "fbid";

export class Admin extends BaseModel {
    static createTable(db: knex) {
        return db.schema.createTable(TABLE_NAME, (table) => {
            table.string(ID_ATTRIBUTE).primary();
        });
    }
    get tableName() { return TABLE_NAME; }
    get idAttribute() { return ID_ATTRIBUTE; }

    // columns
    get fbid(): string { return this.get("fbid"); }

    deployments() {
        return this.belongsToMany(Deployment);
    }

    sendMessage(message: FBTypes.MessengerMessage) {
        return bot.sendMessage(this.fbid, message);
    }
}