import { Volunteer } from "../models/volunteer";

const text = "Sorry about that, here are the correct details!";
Volunteer.collection<Volunteer>().query((qb) => {
    qb.where("deployment_id", 3)
    .whereNotNull("current_task")
    .where("last_messaged", ">", "2017-03-10 17:25:00+00");
}).fetch({withRelated: ["currentTask"]})
.then((volunteers) => {
    return Promise.all(volunteers.map(vol => {
        return vol.currentTask().fetch()
        .then(task => task.getProposalMessage(vol, text))
        .then(msg => msg.send());
    }));
}).then(() => process.exit(0))
.catch((err) => {
    console.log(err);
    process.exit(1);
});