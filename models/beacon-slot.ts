import * as Promise from "bluebird";
import * as _ from "lodash";

import bookshelf = require("../bookshelf");
import {Beacon} from "./beacon";

export class BeaconSlot extends bookshelf.Model<BeaconSlot> {
    static getNSlots(n, deploymentId) {
        return this.collection()
        .query((qb) => {
            qb.where({
                beacon_id: null,
                in_progress: false,
                deployment_id: deploymentId
            }).orderBy("floor", "ASC")
            .orderBy("id", "ASC")
            .limit(n);
        }).fetch();
    }

    get tableName() { return "beacon_slots"; }

    beacon() {
        return this.hasOne(Beacon, "slot");
    }
}