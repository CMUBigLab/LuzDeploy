import { BaseModel } from "./base";
import * as Promise from "bluebird";
import * as _ from "lodash";

import bookshelf = require("../bookshelf");
import {BeaconSlot} from "./beacon-slot";

export class Beacon extends BaseModel {
    get tableName() { return "beacons"; } 
    slot() {
        return this.belongsTo(BeaconSlot);
    }
}