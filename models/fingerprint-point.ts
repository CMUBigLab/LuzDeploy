import { BaseModel } from "./base";
import * as _ from "lodash";
import * as Promise from "bluebird";

import bookshelf = require("../bookshelf");
import {FingerprintSample} from "./fingerprint-sample";

export class FingerprintPoint extends BaseModel<FingerprintPoint> {
    static getPointsForSampling(deploymentId: number, limit = 1) {
        return FingerprintPoint
        .collection()
        .fetch({withRelated: ["samples"]})
        .then(function(points) {
            return points.sortBy(function(p) {
                return p.related("samples").length;
            }).slice(0, limit);
        });
    }

    get tableName() { return "fingerprint_point"; }

    get floor(): number { return this.get("floor"); }
    get latitude(): number { return this.get("latitude"); }
    get longitude(): number { return this.get("longitude"); }

    samples() {
        return this.hasMany(FingerprintSample, "fingerprint_id");
    }
}