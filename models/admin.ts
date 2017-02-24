import bookshelf = require("../bookshelf");
import {bot} from "../app";

import {Deployment} from "./deployment";

export class Admin extends bookshelf.Model<Admin> {
    get tableName() { return "admins"; }
    get idAttribute() { return "fbid"; }
    constructor(params: any) {
        super(params);
    }

    static sendError(error) {
        return this.fetchAll().then(admins => {
            admins.forEach((a: Admin) => a.sendMessage({text: error.stack.slice(0, 640)}));
        });
    }

    deployments() {
        return this.belongsToMany(Deployment);
    }

    sendMessage(message) {
        return bot.sendMessage(this.get("fbid"), message);
    }
}