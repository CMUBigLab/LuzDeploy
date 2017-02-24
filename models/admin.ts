import * as FBTypes from "facebook-sendapi-types";
import * as logger from "winston";

import bookshelf = require("../bookshelf");
import {bot} from "../app";
import {Deployment} from "./deployment";

export class Admin extends bookshelf.Model<Admin> {
    get tableName() { return "admins"; }
    get idAttribute() { return "fbid"; }

    static sendError(error: Error) {
        return this.fetchAll()
        .then(admins => {
            admins.forEach((a: Admin) => a.sendMessage({text: error.stack.slice(0, 640)}));
        });
    }

    deployments() {
        return this.belongsToMany(Deployment);
    }

    sendMessage(message: FBTypes.MessengerMessage) {
        return bot.sendMessage(this.get("fbid"), message);
    }
}