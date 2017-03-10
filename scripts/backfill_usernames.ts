import * as moniker from "moniker";
import * as Promise from "bluebird";

import {Volunteer} from "../models/volunteer";

const animals = moniker.read("../animals.txt");
const names = moniker.generator([moniker.adjective, animals]);

Volunteer.fetchAll<Volunteer>()
.then(volunteers => {
    const takenNames = volunteers.map(v => v.username);
    return Promise.all(volunteers.map(vol => {
        if (vol.username === null) {
            let newName = names.choose();
            while (takenNames.some(s => s === newName)) {
                newName = names.choose();
            }
            takenNames.push(newName);
            return vol.save({username: newName}, {patch: true});
        } else {
            return null;
        }
    }));
}).then(() => process.exit(0));

