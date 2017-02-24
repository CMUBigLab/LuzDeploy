import * as _ from "lodash";
import * as s from "underscore.string";

import bookshelf = require("../bookshelf");

export class BaseModel<T> extends bookshelf.Model<BaseModel<T>> {
    constructor(params: any) {
        super(params);
    }

    // convert snake_case to camelCase
    parse(response: any) {
        return _.reduce(response, function(memo, val, key) {
            memo[s.camelize(key)] = val;
            return memo;
        }, {});
    }

    // convert camelCase to snake_case
    format(attributes: any) {
        return _.reduce(attributes, function(memo, val, key) {
            memo[s.underscored(key)] = val;
            return memo;
        }, {});
    }
}