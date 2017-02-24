if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
}
if (!process.env.HEROKU_APP_NAME) {
    throw new Error("HEROKU_APP_NAME is required.");
}

let threadId = process.env.HEROKU_APP_NAME === "luzdeploy-staging" ?
    "1146606925407192" : "720072294762496";

export let DB_CONFIG = {
    client: "pg",
    connection: process.env.DATABASE_URL,
    debug: process.env.DEBUG
};
export const BASE_URL = `https://${process.env.HEROKU_APP_NAME}.herokuapp.com`;
export const THREAD_URI = `fb-messenger://user/${threadId}`;