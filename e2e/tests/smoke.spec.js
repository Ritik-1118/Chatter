import { createUser, expect, openApp, sendViaApi, test } from "./fixtures.js";

test("smoke: signed-in user sees their chat list", async ({ openAs }) => {
    const alice = await createUser("Alice");
    const bob = await createUser("Bob");
    await sendViaApi(bob, alice, "hello from bob");
    const page = await openAs(alice);
    await openApp(page);
    await expect(page.getByRole("button", { name: "Open chat with Bob" })).toBeVisible();
    expect(page.errors).toEqual([]);
});
