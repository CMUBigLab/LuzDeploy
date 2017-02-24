import * as FBTypes from "facebook-sendapi-types";
import * as logger from "winston";

import bookshelf = require("../bookshelf");
import * as app from "../app";
import {Deployment} from "./deployment";

export class Admin extends bookshelf.Model<Admin> {
    get tableName() { return "admins"; }
    get idAttribute() { return "fbid"; }

    deployments() {
        return this.belongsToMany(Deployment);
    }

    sendMessage(message: FBTypes.MessengerMessage) {
        return app.bot.sendMessage(this.get("fbid"), message);
    }
}