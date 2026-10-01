import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 5000;
const cache = new Map(); // url -> { at, value }
const TTL_MS = 60 * 60 * 1000;

// Blocks loopback, private, link-local, CGNAT, multicast and reserved ranges (SSRF guard).
export function isPublicAddress(address) {
    if (net.isIPv4(address)) {
        const [a, b] = address.split(".").map(Number);
        return !(
            a === 0 ||
            a === 10 ||
            a === 127 ||
            a >= 224 ||
            (a === 100 && b >= 64 && b <= 127) ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) ||
            (a === 198 && (b === 18 || b === 19))
        );
    }
    if (net.isIPv6(address)) {
        const v = address.toLowerCase();
        if (v.startsWith("::ffff:")) return isPublicAddress(v.slice(7));
        return !(
            v === "::" ||
            v === "::1" ||
            v.startsWith("fc") ||
            v.startsWith("fd") ||
            v.startsWith("fe8") ||
            v.startsWith("fe9") ||
            v.startsWith("fea") ||
            v.startsWith("feb") ||
            v.startsWith("ff")
        );
    }
    return false;
}

// Validates the address at connect time, so DNS rebinding cannot bypass the check.
function safeLookup(hostname, options, callback) {
    dns.lookup(hostname, { ...options, all: false }, (err, address, family) => {
        if (err) return callback(err);
        if (!isPublicAddress(address)) return callback(new Error("blocked address"));
        callback(null, address, family);
    });
}

function fetchHtml(url, redirects = 3) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        if (!["http:", "https:"].includes(u.protocol)) return reject(new Error("bad protocol"));
        if (u.port && !["80", "443"].includes(u.port)) return reject(new Error("bad port"));
        const lib = u.protocol === "https:" ? https : http;
        const req = lib.get(u, { lookup: safeLookup, timeout: TIMEOUT_MS, headers: { "User-Agent": "ChatterLinkPreview/1.0", Accept: "text/html" } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                if (!redirects) return reject(new Error("too many redirects"));
                return resolve(fetchHtml(new URL(res.headers.location, u).toString(), redirects - 1));
            }
            if (res.statusCode !== 200 || !/text\/html/i.test(res.headers["content-type"] || "")) {
                res.resume();
                return reject(new Error("not html"));
            }
            let size = 0;
            const chunks = [];
            res.on("data", (c) => {
                size += c.length;
                if (size > MAX_BYTES) {
                    req.destroy();
                    resolve(Buffer.concat(chunks).toString("utf8"));
                } else chunks.push(c);
            });
            res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
            res.on("error", reject);
        });
        req.on("timeout", () => req.destroy(new Error("timeout")));
        req.on("error", reject);
    });
}

const decode = (s) =>
    s
        ?.replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();

function meta(html, prop) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, "i");
    const tag = html.match(re)?.[0];
    return decode(tag?.match(/content=["']([^"']*)["']/i)?.[1]);
}

export async function linkPreview(url) {
    const hit = cache.get(url);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
    let value = null;
    try {
        const html = await fetchHtml(url);
        const title = meta(html, "og:title") || decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]);
        if (title) {
            const image = meta(html, "og:image");
            value = {
                url,
                title: title.slice(0, 200),
                description: (meta(html, "og:description") || meta(html, "description") || "").slice(0, 300),
                image: image && /^https:\/\//i.test(image) ? image : null,
                siteName: meta(html, "og:site_name") || new URL(url).hostname,
            };
        }
    } catch {
        value = null;
    }
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    cache.set(url, { at: Date.now(), value });
    return value;
}
