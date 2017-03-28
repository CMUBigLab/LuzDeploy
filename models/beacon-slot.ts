import { BaseModel } from "./base";
import * as Promise from "bluebird";
import * as _ from "lodash";

import bookshelf = require("../bookshelf");
import {Beacon} from "./beacon";

export class BeaconSlot extends BaseModel<BeaconSlot> {
    static getNSlots(n, deploymentId) {
        return BeaconSlot.collection()
        .query((qb) => {
            qb.where({
                beacon_id: null,
                in_progress: false,
                status: null,
                deployment_id: deploymentId
            }).orderBy("floor", "ASC")
            .orderBy("id", "ASC")
            .limit(n);
        }).fetch();
    }

    get tableName() { return "beacon_slots"; }
    get id() { return this.get("id"); }
    beacon() {
        return this.hasOne(Beacon, "slot");
    }

    static getProgress() {
        const total = BeaconSlot.collection().count();
        const completed = BeaconSlot.collection()
        .query((qb) => {
            qb.whereNotNull("beacon_id");
            }).count();
        return Promise.join(total, completed, (total, completed) => {
            const percent = Math.floor((completed / total) * 100);
            return {total, completed, percent};
        });
    }
}