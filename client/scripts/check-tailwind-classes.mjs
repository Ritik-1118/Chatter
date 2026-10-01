// Fails when a component uses a class name that produces no CSS — e.g. a colour
// token that was never defined in tailwind.config.js (finding B-C08).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "tw-")), "out.css");
execFileSync(process.execPath, [path.join(root, "node_modules/tailwindcss/lib/cli.js"), "-i", "src/styles/globals.css", "-o", out], {
    cwd: root,
    stdio: "pipe",
});
const css = fs.readFileSync(out, "utf8");

// Marker classes that intentionally have no CSS of their own.
const MARKERS = new Set(["group", "peer"]);

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
const files = walk(path.join(root, "src")).filter((f) => /\.(jsx?|tsx?)$/.test(f));

// String literals inside className={...} / className="..." (template parts and nested quotes).
function classStrings(source) {
    const results = [];
    const re = /className=(?:"([^"]*)"|\{)/g;
    let m;
    while ((m = re.exec(source))) {
        if (m[1] !== undefined) {
            results.push(m[1]);
            continue;
        }
        let depth = 1;
        let i = re.lastIndex;
        while (i < source.length && depth) {
            if (source[i] === "{") depth++;
            else if (source[i] === "}") depth--;
            i++;
        }
        const expr = source.slice(re.lastIndex, i - 1).replace(/\$\{/g, " ${");
        for (const lit of expr.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`/g)) results.push((lit[1] ?? lit[2] ?? lit[3]).replace(/\$\{[^}]*\}/g, " "));
    }
    return results;
}

const escape = (cls) => cls.replace(/([:/[\].%#!()&>+~=,'"*])/g, "\\$1");
const missing = [];
for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const str of classStrings(source)) {
        for (const cls of str.split(/\s+/)) {
            if (!cls || MARKERS.has(cls) || !/^[!-]?[a-z0-9@][\w:[\]/.%#()-]*$/.test(cls) || cls.endsWith("-")) continue;
            if (!css.includes(`.${escape(cls)}`)) missing.push(`${path.relative(root, file)}: ${cls}`);
        }
    }
}

if (missing.length) {
    console.error(`Classes with no generated CSS:\n  ${[...new Set(missing)].join("\n  ")}`);
    process.exit(1);
}
console.log(`Tailwind class check passed (${files.length} files).`);
