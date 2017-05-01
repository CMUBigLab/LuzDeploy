import { BaseModel } from "./base";
import * as Promise from "bluebird";
import * as _ from "lodash";

import bookshelf = require("../bookshelf");
import {BeaconSlot} from "./beacon-slot";

export class Beacon extends BaseModel<Beacon> {
    get tableName() { return "beacons"; } 
    slot() {
        return this.belongsTo(BeaconSlot);
    }

    get minorId(): number { return this.get("minor_id"); }
    get deploymentId(): number { return this.get("deployment_id"); }
    get lastSwept(): Date { return this.get("last_swept"); }
}