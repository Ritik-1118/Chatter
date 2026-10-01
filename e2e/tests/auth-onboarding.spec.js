import sharp from "../../server/node_modules/sharp/dist/index.mjs";
import { makeUser } from "../../server/test/helpers/harness.js";
import { bubbles, chatItem, chatList, createUser, db, expect, openApp, openChat, sendViaApi, test } from "./fixtures.js";

async function realJpeg(kb) {
    const side = Math.ceil(Math.sqrt((kb * 1024) / 3)) + 40;
    const noise = Buffer.alloc(side * side * 3).map(() => Math.floor(Math.random() * 256));
    return sharp(noise, { raw: { width: side, height: side, channels: 3 } }).jpeg({ quality: 95 }).toBuffer();
}

test.describe("Authentication & onboarding", () => {
    test("signed-out visitor is redirected from / to /login", async ({ page }) => {
        await page.goto("/");
        await expect(page).toHaveURL(/\/login$/);
        await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
    });

    test("[B-C25] new user signs in, creates a profile and lands in the app with a single navigation", async ({ openAs }) => {
        const newbie = makeUser("Newbie");
        const page = await openAs(newbie, { pending: true });
        const aborted = [];
        page.on("console", (m) => /Abort fetching component/.test(m.text()) && aborted.push(m.text()));
        await page.goto("/login");
        await page.getByRole("button", { name: "Sign in with Google" }).click();
        await expect(page).toHaveURL(/\/onboarding$/);
        await page.getByLabel("Display Name").fill("Newbie User");
        await page.getByRole("button", { name: "Create profile" }).click();
        await expect(page).toHaveURL(/\/$/);
        await expect(chatList(page)).toBeVisible();
        expect(page.errors).toEqual([]);
        expect(aborted).toEqual([]);
    });

    test("[B-S12][B-C34] new user can onboard with an uploaded profile photo", async ({ openAs }) => {
        const newbie = makeUser("PhotoUser");
        const page = await openAs(newbie, { pending: true });
        await page.goto("/login");
        await page.getByRole("button", { name: "Sign in with Google" }).click();
        await expect(page).toHaveURL(/\/onboarding$/);

        await page.getByRole("button", { name: "Change profile photo" }).click();
        const chooser = page.waitForEvent("filechooser");
        await page.getByRole("menuitem", { name: "Upload photo" }).click();
        await (await chooser).setFiles({ name: "me.jpg", mimeType: "image/jpeg", buffer: await realJpeg(400) });
        await expect(page.getByRole("button", { name: "Change profile photo" }).locator("img")).toHaveAttribute("src", /^data:image\/jpeg/);

        await page.getByLabel("Display Name").fill("Photo User");
        await page.getByRole("button", { name: "Create profile" }).click();
        await expect(page).toHaveURL(/\/$/);
        const saved = await (await db()).collection("users").findOne({ email: newbie.email });
        expect(saved.profilePicture).toMatch(/^\/uploads\/avatars\/.+\.webp$/);
    });

    test("[B-C24] clicking the chat-list menu icon opens the menu", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const page = await openAs(alice);
        await openApp(page);
        await page.getByRole("button", { name: "Menu", exact: true }).click();
        await expect(page.getByRole("menuitem", { name: "Logout" })).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("menuitem", { name: "Logout" })).toHaveCount(0);
    });

    test("[B-C21] visiting /logout directly signs out without a runtime error", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const page = await openAs(alice);
        await page.goto("/logout");
        await expect(page).toHaveURL(/\/login$/);
        await expect(page.getByText("Application error")).toHaveCount(0);
        expect(page.errors).toEqual([]);
    });

    test("[B-C14] after logout, the next user never sees the previous user's cached messages", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        const dave = await createUser("Dave");
        await sendViaApi(bob, alice, "private note for alice");
        await sendViaApi(bob, dave, "hello dave");

        const page = await openAs(alice);
        await openApp(page);
        await openChat(page, bob.name);
        await expect(bubbles(page).filter({ hasText: "private note for alice" })).toBeVisible();

        await page.getByRole("button", { name: "Menu", exact: true }).click();
        await page.getByRole("menuitem", { name: "Logout" }).click();
        await expect(page).toHaveURL(/\/login$/);

        // Dave signs in on the same tab (shared computer), on a slow network.
        await page.route(/\/messages(\?|$)/, async (route) => {
            await new Promise((r) => setTimeout(r, 1500));
            await route.continue();
        });
        await page.evaluate(
            (identity) => window.localStorage.setItem("__e2e_pending_user", JSON.stringify(identity)),
            { uid: dave.uid, email: dave.email, displayName: dave.name, photoURL: null },
        );
        await page.getByRole("button", { name: "Sign in with Google" }).click();
        await expect(page).toHaveURL(/\/$/);
        await chatItem(page, bob.name).click();
        // Sample without auto-retry: a stale cache would only be visible until the fetch lands.
        const seen = [];
        for (let i = 0; i < 10; i++) {
            seen.push(...(await bubbles(page).allTextContents()));
            await page.waitForTimeout(100);
        }
        expect(seen).not.toContain("private note for alice");
        await expect(bubbles(page).filter({ hasText: "hello dave" })).toBeVisible();
    });

    test("[B-C26][G-01] a returning user sees and can edit their profile", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const bob = await createUser("Bob");
        await sendViaApi(alice, bob, "hi");
        const a = await openAs(alice);
        const b = await openAs(bob);
        await openApp(a);
        await openApp(b);
        await expect(chatItem(b, alice.name)).toBeVisible();

        await a.getByRole("button", { name: "Profile", exact: true }).click();
        const dialog = a.getByRole("dialog", { name: "Profile" });
        await expect(dialog.getByLabel("About")).toHaveValue(`${alice.name}'s status`);
        await dialog.getByLabel("Display Name").fill("Alice Renamed");
        await dialog.getByRole("button", { name: "Save changes" }).click();
        await expect(dialog).toHaveCount(0);
        // Bob sees the new name without reloading.
        await expect(chatItem(b, "Alice Renamed")).toBeVisible();
    });

    test("[B-C22] the photo menu in the Profile dialog works without crashing", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const page = await openAs(alice);
        await openApp(page);
        await page.getByRole("button", { name: "Profile", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Profile" });
        await dialog.getByRole("button", { name: "Change profile photo" }).click();
        await page.getByRole("menuitem", { name: "Remove photo" }).click();
        await expect(dialog.getByRole("button", { name: "Save changes" })).toBeEnabled();
        expect(page.errors).toEqual([]);
    });
});
