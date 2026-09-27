import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "./e2e", timeout: 20000, use: { baseURL: "http://127.0.0.1:4173", headless: true, launchOptions: { executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" } }, webServer: { command: "npm run dev -- --host 127.0.0.1 --port 4173", url: "http://127.0.0.1:4173", reuseExistingServer: true } });
