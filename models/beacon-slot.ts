import { BaseModel } from "./base";
import * as Promise from "bluebird";
import * as _ from "lodash";

import bookshelf = require("../bookshelf");
import {Beacon} from "./beacon";

export class BeaconSlot extends BaseModel<BeaconSlot> {
    static getNSlots(n, deploymentId) {
        return this.collection<BeaconSlot>()
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

    beacon() {
        return this.hasOne(Beacon, "slot");
    }

    get startNode(): number { return this.get("start_node"); }
    get endNode(): number { return this.get("end_node"); }
    get edge(): number { return this.get("edge"); }
    get deploymentId(): number { return this.get("deployment_id"); }

    static getProgress(deploymentId: number) {
        console.log("getProgress", deploymentId);
        const total = BeaconSlot.collection<BeaconSlot>()
        .query({where: {deployment_id: deploymentId}})
        .count();
        const completed = BeaconSlot.collection<BeaconSlot>()
        .query((qb) => {
            qb.whereNotNull("beacon_id")
            .where("deployment_id", deploymentId);
        }).count();
        return Promise.join(total, completed, (total, completed) => {
            const percent = Math.floor((completed / total) * 100);
            return {total, completed, percent};
        });
    }
}