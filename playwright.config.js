import { defineConfig, devices } from "@playwright/test";
import "./shared/config.js";
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? {
          launchOptions: {
            executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
            args: ["--no-sandbox", "--disable-dev-shm-usage"],
          },
        }
      : {}),
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "node scripts/init-db.mjs && node tests/e2e/seed-schedules.mjs && npm run dev",
    url: "http://127.0.0.1:5173",
    timeout: 60000,
    reuseExistingServer: false,
    env: {
      DB_PREFIX: `${process.env.DB_PREFIX || "virelia"}_e2e`,
      EMAIL_LOGIN_OTP: "false",
      SMTP_HOST: "",
      SEED_DEMO: "true",
  REQUIRE_EMAIL_VERIFICATION: "false",
    },
  },
});
