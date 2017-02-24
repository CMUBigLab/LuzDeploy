import * as Promise from "bluebird";
import * as _ from "lodash";

import bookshelf = require("../bookshelf");
import {Beacon} from "./beacon";

export class BeaconSlot extends bookshelf.Model<BeaconSlot> {
    static getNSlots(n, deploymentId) {
        return this.collection()
        .query({where: {
            beacon_id: null,
            in_progress: false,
            deployment_id: deploymentId
        }}).fetch()
        .then(function(slots) {
            // TODO: Be smarter about finding clusters of beacons
            return slots.sortBy(["floor", "id"]).slice(0, n);
        });
    }

    get tableName() { return "beacon_slots"; }

    beacon() {
        return this.hasOne(Beacon, "slot");
    }
}