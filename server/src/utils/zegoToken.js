import crypto from "node:crypto";

// Zego "token04" generator (port of Zego's reference implementation), using
// cryptographically secure randomness for the nonce and IV.
export function generateToken04(appId, userId, secret, effectiveTimeInSeconds, payload = "") {
    if (!Number.isInteger(appId) || appId <= 0) throw new Error("appID invalid");
    if (!userId || typeof userId !== "string") throw new Error("userId invalid");
    if (typeof secret !== "string" || secret.length !== 32) throw new Error("secret must be a 32 byte string");
    if (!Number.isInteger(effectiveTimeInSeconds) || effectiveTimeInSeconds <= 0) throw new Error("effectiveTimeInSeconds invalid");

    const createTime = Math.floor(Date.now() / 1000);
    const tokenInfo = {
        app_id: appId,
        user_id: userId,
        nonce: crypto.randomInt(-2147483648, 2147483647),
        ctime: createTime,
        expire: createTime + effectiveTimeInSeconds,
        payload,
    };
    const iv = crypto.randomBytes(8).toString("hex"); // 16 chars, as the reference expects
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(secret), iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(tokenInfo)), cipher.final()]);

    const expire = Buffer.alloc(8);
    expire.writeBigInt64BE(BigInt(tokenInfo.expire));
    const ivLen = Buffer.alloc(2);
    ivLen.writeUInt16BE(iv.length);
    const encLen = Buffer.alloc(2);
    encLen.writeUInt16BE(encrypted.length);
    return `04${Buffer.concat([expire, ivLen, Buffer.from(iv), encLen, encrypted]).toString("base64")}`;
}
