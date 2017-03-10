import { BaseModel } from "./base";
import * as _ from "lodash";
import * as Promise from "bluebird";

import bookshelf = require("../bookshelf");

export class FingerprintSample extends BaseModel<FingerprintSample> {
    get tableName() { return "sample"; }
}