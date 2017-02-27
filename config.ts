const env = process.env.NODE_ENV;

if ((env === "staging" || env === "production") && !process.env.HEROKU_APP_NAME) {
    throw new Error("HEROKU_APP_NAME is required.");
}

let threadId = process.env.HEROKU_APP_NAME === "luzdeploy-staging" ?
    "1146606925407192" : "720072294762496";

export const BASE_URL = `https://${process.env.HEROKU_APP_NAME}.herokuapp.com`;
export const THREAD_URI = `fb-messenger://user/${threadId}`;

export const DATE_FORMAT = "YYYY-MM-DD HH:mm:ss";