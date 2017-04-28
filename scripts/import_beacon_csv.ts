import * as fs from "fs";
import * as parse from "csv-parse";
import {Beacon, BeaconSlot} from "../models";
import * as Promise from "bluebird";

interface BeaconRow {
    bid: number;
    minor: number;
    lat: number;
    lng: number;
    edge: number;
    floor: number;
    start: number;
    end: number;
}

let parser = parse({delimiter: ",", columns: true}, function(err, data){
    return Promise.map<BeaconRow, any>(data, function(b) {
        return new BeaconSlot({
            id: b.bid,
            lat: b.lat,
            long: b.lng,
            edge: b.edge,
            floor: b.floor,
            start_node: b.start,
            end_node: b.end,
            deployment_id: 6,
        }).save(null, {method: "insert"})
        .then(function(slot) {
            return new Beacon({
                id: b.bid,
                minor_id: b.minor,
                slot: slot.id,
                deployment_id: 6,
            }).save(null, {method: "insert"})
            .then(function(beacon) {
                return slot.save({beacon_id: beacon.id}, {method: "update"});
            });
        }).then(() => process.exit())
        .catch(err => {
            console.log(err);
            process.exit(1);
        });
    });
});

fs.createReadStream(__dirname + "/BeaconsCraigSt.csv").pipe(parser);