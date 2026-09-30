import { makeUser } from "../../server/test/helpers/harness.js";
import { bubbles, chatItem, createUser, expect, menuIcon, openApp, openChat, openMenu, sendViaApi, test } from "./fixtures.js";

test.describe("Authentication & onboarding", () => {
    test("signed-out visitor is redirected from / to /login", async ({ page }) => {
        await page.goto("/");
        await expect(page).toHaveURL(/\/login$/);
        await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
    });

    test("new user signs in, creates a profile and lands in the app", async ({ openAs }) => {
        const newbie = makeUser("Newbie");
        const page = await openAs(newbie, { pending: true });
        await page.goto("/login");
        await page.getByRole("button", { name: "Sign in with Google" }).click();
        await expect(page).toHaveURL(/\/onboarding$/);
        await page.getByLabel("Display Name").fill("Newbie User");
        await page.getByRole("button", { name: "Create profile" }).click();
        await expect(page).toHaveURL(/\/$/);
        await expect(page.getByRole("navigation", { name: "Chat list" })).toBeVisible();
        expect(page.errors).toEqual([]);
    });

    test("[B-S12] new user can onboard with an uploaded profile photo", async ({ openAs }) => {
        const newbie = makeUser("PhotoUser");
        const page = await openAs(newbie, { pending: true });
        await page.goto("/login");
        await page.getByRole("button", { name: "Sign in with Google" }).click();
        await expect(page).toHaveURL(/\/onboarding$/);

        await page.getByAltText("Avatar").hover();
        await page.getByText("Change profile photo").click();
        const chooser = page.waitForEvent("filechooser");
        await page.getByText("Upload photo").click();
        // ~200 KB image, typical of a compressed phone photo.
        await (await chooser).setFiles({ name: "me.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(200 * 1024, 9) });
        await page.waitForTimeout(500);

        await page.getByLabel("Display Name").fill("Photo User");
        await page.getByRole("button", { name: "Create profile" }).click();
        await expect(page.getByRole("alert")).toHaveCount(0);
        await expect(page).toHaveURL(/\/$/);
    });

    test("[B-C24] clicking the chat-list menu icon opens the menu", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const page = await openAs(alice);
        await openApp(page);
        await menuIcon(page).click(); // a normal click, which lands on the icon's <path>
        await expect(page.getByText("Logout")).toBeVisible();
    });

    test("[B-C21] visiting /logout directly signs out without a runtime error", async ({ openAs }) => {
        const alice = await createUser("Alice");
        const page = await openAs(alice);
        await page.goto("/logout");
        await page.waitForTimeout(1000);
        await expect(page.getByText("Application error")).toHaveCount(0);
        expect(page.errors).toEqual([]);
        await expect(page).toHaveURL(/\/login$/);
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

        await openMenu(menuIcon(page));
        await page.getByText("Logout").click();
        await expect(page).toHaveURL(/\/login$/);

        // Dave signs in on the same tab (shared computer), on a realistic network.
        await page.route(/get-messages/, async (route) => {
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
        // Sample without auto-retry: the stale cache is only visible until the fetch lands.
        const seen = [];
        for (let i = 0; i < 10; i++) {
            seen.push(...(await bubbles(page).allTextContents()));
            await page.waitForTimeout(100);
        }
        expect(seen).not.toContain("private note for alice");
    });
});
