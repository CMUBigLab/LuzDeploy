// source: https://github.com/fyndme/facebook-send-api/issues/1
import * as crypto from "crypto";

export default function createSignature(payload: Buffer | string,
secret: string = process.env.FB_APP_SECRET) {
    const hmac = crypto.createHmac("sha1", secret);
    hmac.update(payload, "utf8");
    return `sha1=${hmac.digest("hex")}`;
}