import * as moniker from "moniker";
import * as Promise from "bluebird";

import {Volunteer} from "../models/volunteer";

Volunteer.fetchAll<Volunteer>()
.then(volunteers => {
    const takenNames = volunteers.map(v => v.username);
    return Promise.all(volunteers.map(vol => {
        if (vol.username === null) {
            let newName = moniker.choose();
            while (takenNames.some(s => s === newName)) {
                newName = moniker.choose();
            }
            takenNames.push(newName);
            return vol.save({username: newName}, {patch: true});
        } else {
            return null;
        }
    }));
}).then(() => process.exit(0));

