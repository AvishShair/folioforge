import { defineConfig, devices } from "@playwright/test";
const remoteBaseURL = process.env.PLAYWRIGHT_BASE_URL;
export default defineConfig({
  testDir: "e2e",
  timeout: 60000,
  fullyParallel: false,
  use: {
    baseURL: remoteBaseURL || "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: remoteBaseURL
    ? undefined
    : {
        command: "npm run start -- --hostname 127.0.0.1",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
