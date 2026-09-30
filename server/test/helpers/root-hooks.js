import { startMongo, stopMongo } from "./harness.js";

export const mochaHooks = {
    async beforeAll() {
        this.timeout(120000);
        await startMongo();
    },
    async afterAll() {
        await stopMongo();
    },
};
