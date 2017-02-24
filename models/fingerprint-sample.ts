import * as _ from "lodash";
import * as Promise from "bluebird";

import bookshelf = require("../bookshelf");

export class FingerprintSample extends bookshelf.Model<FingerprintSample> {
    get tableName() { return "sample"; }
}