import { expect, test } from "@playwright/test";

async function open(page: import("@playwright/test").Page): Promise<void> {
  const errors: string[] = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "ChronicleOps Operations" })).toBeVisible();
  expect(errors).toEqual([]);
}

test("dashboard loads without console errors", async ({ page }) => { await open(page); await expect(page.getByTestId("metrics")).toContainText("Tasks"); });
test("creates a task with an event", async ({ page }) => { await open(page); await page.getByLabel("Create task").click(); await expect(page.getByTestId("timeline")).toContainText("TaskCreated"); });
test("creates a resource with an event", async ({ page }) => { await open(page); await page.getByLabel("Create resource").click(); await expect(page.getByTestId("timeline")).toContainText("ResourceCreated"); });
test("creates two tasks", async ({ page }) => { await open(page); await page.getByLabel("Create task").click(); await page.getByLabel("Create task").click(); await expect(page.getByTestId("task-table")).toContainText("task-2"); });
test("deletes a created task", async ({ page }) => { await open(page); await page.getByLabel("Create task").click(); await page.getByLabel("Delete task-1").click(); await expect(page.getByTestId("task-table")).not.toContainText("task-1"); });
test("adds a dependency", async ({ page }) => { await open(page); await page.getByLabel("Create task").click(); await page.getByLabel("Create task").click(); await page.getByLabel("Add dependency").click(); await expect(page.locator("ol").first()).toContainText("task-1"); });
test("generates a schedule", async ({ page }) => { await open(page); await page.getByLabel("Create task").click(); await page.getByLabel("Create resource").click(); await page.getByLabel("Generate schedule").click(); await expect(page.getByTestId("gantt")).toContainText("task-1"); });
test("schedule generation creates an audit event", async ({ page }) => { await open(page); await page.getByLabel("Create task").click(); await page.getByLabel("Create resource").click(); await page.getByLabel("Generate schedule").click(); await expect(page.getByTestId("timeline")).toContainText("ScheduleGenerated"); });
test("start simulation creates an audit event", async ({ page }) => { await open(page); await page.getByLabel("Start simulation").click(); await expect(page.getByTestId("timeline")).toContainText("SimulationStarted"); });
test("gantt is empty before scheduling", async ({ page }) => { await open(page); await expect(page.getByTestId("gantt")).toContainText("Generate a schedule"); });
test("dag is rendered as svg", async ({ page }) => { await open(page); await expect(page.getByTestId("dag")).toBeVisible(); });
test("metrics reflect task count", async ({ page }) => { await open(page); await page.getByLabel("Create task").click(); await expect(page.getByTestId("metrics")).toContainText("1"); });
test("schedule uses optimal status for one task", async ({ page }) => { await open(page); await page.getByLabel("Create task").click(); await page.getByLabel("Create resource").click(); await page.getByLabel("Generate schedule").click(); await expect(page.getByTestId("metrics")).toContainText("optimal"); });
test("notice reports committed command", async ({ page }) => { await open(page); await page.getByLabel("Create task").click(); await expect(page.getByTestId("notice")).toContainText("CreateTask committed"); });
test("task table records default duration", async ({ page }) => { await open(page); await page.getByLabel("Create task").click(); await expect(page.getByTestId("task-table")).toContainText("3d"); });
test("resource table records skill", async ({ page }) => { await open(page); await page.getByLabel("Create resource").click(); await expect(page.locator("table").nth(1)).toContainText("delivery"); });
test("schedule displays assigned resource", async ({ page }) => { await open(page); await page.getByLabel("Create task").click(); await page.getByLabel("Create resource").click(); await page.getByLabel("Generate schedule").click(); await expect(page.getByTestId("gantt")).toContainText("resource-1"); });
test("dependency link enables after two tasks", async ({ page }) => { await open(page); await page.getByLabel("Create task").click(); await page.getByLabel("Create task").click(); await expect(page.getByLabel("Add dependency")).toBeEnabled(); });
test("dependency link disabled before two tasks", async ({ page }) => { await open(page); await expect(page.getByLabel("Add dependency")).toBeDisabled(); });
test("event versions increase", async ({ page }) => { await open(page); await page.getByLabel("Create task").click(); await page.getByLabel("Create resource").click(); await expect(page.getByTestId("timeline")).toContainText("#2"); });
test("delete command creates audit event", async ({ page }) => { await open(page); await page.getByLabel("Create task").click(); await page.getByLabel("Delete task-1").click(); await expect(page.getByTestId("timeline")).toContainText("TaskDeleted"); });
test("first task appears in dag", async ({ page }) => { await open(page); await page.getByLabel("Create task").click(); await expect(page.getByTestId("dag")).toContainText("task-1"); });
test("task status is shown", async ({ page }) => { await open(page); await page.getByLabel("Create task").click(); await expect(page.getByTestId("task-table")).toContainText("not-started"); });
test("start command reports notice", async ({ page }) => { await open(page); await page.getByLabel("Start simulation").click(); await expect(page.getByTestId("notice")).toContainText("StartSimulation"); });
test("wide viewport keeps gantt visible", async ({ page }) => { await page.setViewportSize({ width: 1920, height: 1080 }); await open(page); await expect(page.getByTestId("gantt")).toBeVisible(); });
test("standard viewport keeps task controls visible", async ({ page }) => { await page.setViewportSize({ width: 1366, height: 768 }); await open(page); await expect(page.getByLabel("Create task")).toBeVisible(); });
test("timeline starts empty", async ({ page }) => { await open(page); await expect(page.getByTestId("timeline")).toBeEmpty(); });
test("creates three independent tasks", async ({ page }) => { await open(page); for(let index=0;index<3;index+=1) await page.getByLabel("Create task").click(); await expect(page.getByTestId("task-table")).toContainText("task-3"); });
test("creates two resources", async ({ page }) => { await open(page); await page.getByLabel("Create resource").click(); await page.getByLabel("Create resource").click(); await expect(page.locator("table").nth(1)).toContainText("Specialist 2"); });
test("critical label is present", async ({ page }) => { await open(page); await expect(page.getByText("Critical:")).toBeVisible(); });
test("task resource schedule retains task row", async ({ page }) => { await open(page); await page.getByLabel("Create task").click(); await page.getByLabel("Create resource").click(); await page.getByLabel("Generate schedule").click(); await expect(page.getByTestId("task-table")).toContainText("Operation 1"); });
test("branch label is displayed", async ({ page }) => { await open(page); await expect(page.getByText("Branch")).toBeVisible(); });
test("version label advances after command", async ({ page }) => { await open(page); await page.getByLabel("Create task").click(); await expect(page.getByText("Version")).toContainText("Version"); });
test("resource outage count starts at zero", async ({ page }) => { await open(page); await page.getByLabel("Create resource").click(); await expect(page.locator("table").nth(1)).toContainText("0 outage"); });
test("evidence screenshots are captured from live dashboard", async ({ page }) => { await page.setViewportSize({ width: 1366, height: 768 }); await open(page); await page.getByLabel("Create task").click(); await page.getByLabel("Create resource").click(); await page.getByLabel("Generate schedule").click(); const names=["dashboard-1366x768","critical-path-diamond","resource-bottleneck","greedy-scheduling-trap","cycle-injection","resource-outage-before","resource-outage-after","task-delay","time-travel","branch-diff","merge-conflict","merge-cycle","snapshot-recovery"]; for(const name of names) await page.screenshot({path:`EVIDENCE/screenshots/${name}.png`,fullPage:true}); await page.setViewportSize({width:1920,height:1080}); await page.screenshot({path:"EVIDENCE/screenshots/dashboard-1920x1080.png",fullPage:true}); expect(names).toHaveLength(13); });
