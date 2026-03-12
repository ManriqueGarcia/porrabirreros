/**
 * Regression E2E: el ranking NO debe mostrar puntos negativos
 * cuando se publican preguntas adicionales pero aún no hay resultados.
 */
import { test, expect } from "@playwright/test";
import {
  setupTestGroup, loginInBrowser,
  seedF1BetWindow, seedF1Questions, seedF1Bet,
} from "./helpers.mjs";

let ctx;

test.beforeAll(async () => {
  ctx = await setupTestGroup();
  const raceKey = "australia";
  await seedF1BetWindow(ctx.groupId, ctx.adminUser, raceKey);
  await seedF1Questions(ctx.groupId, ctx.adminUser, raceKey, [
    "¿Qué escudería ganará?",
    "¿Habrá safety car?",
    "¿Quién será el piloto del día?",
  ]);
  await seedF1Bet(ctx.groupId, ctx.adminUser, raceKey, {
    pole: "Max Verstappen",
    podium: ["Max Verstappen", "Lewis Hamilton", "Charles Leclerc"],
    q: ["Red Bull", "Sí", "Verstappen"],
    submittedAt: new Date().toISOString(),
    late: false,
  });
  await seedF1Bet(ctx.groupId, ctx.regularUser, raceKey, {
    pole: "",
    podium: ["", "", ""],
    q: ["Mercedes", "No", "Hamilton"],
    submittedAt: new Date().toISOString(),
    late: false,
  });
});

test.describe("Ranking sin resultados — no debe mostrar penalizaciones", () => {
  test("ranking F1 muestra 0 pts para todos cuando no hay resultados publicados", async ({ page }) => {
    await loginInBrowser(page, ctx.groupId, ctx.regularUser, ctx.password);
    await page.click('button[role="tab"]:has-text("Ranking")');
    await page.waitForTimeout(1500);

    const rankingTable = page.locator("table");
    await expect(rankingTable).toBeVisible({ timeout: 10000 });

    const rows = rankingTable.locator("tbody tr");
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    for (let i = 0; i < rowCount; i++) {
      const ptsCells = rows.nth(i).locator("td.pts-cell, td:nth-child(3)");
      const ptsText = await ptsCells.first().textContent();
      const pts = parseInt(ptsText.trim(), 10);
      expect(pts).toBeGreaterThanOrEqual(0);
    }
  });

  test("apuesta parcial (solo preguntas) no genera puntos negativos en ranking", async ({ page }) => {
    await loginInBrowser(page, ctx.groupId, ctx.regularUser, ctx.password);
    await page.click('button[role="tab"]:has-text("Ranking")');
    await page.waitForTimeout(1500);

    const rankingTable = page.locator("table");
    await expect(rankingTable).toBeVisible({ timeout: 10000 });

    const userRow = rankingTable.locator(`tr:has-text("${ctx.regularUser}")`);
    await expect(userRow).toBeVisible({ timeout: 5000 });

    const ptsCell = userRow.locator("td.pts-cell, td:nth-child(3)");
    const ptsText = await ptsCell.first().textContent();
    const pts = parseInt(ptsText.trim(), 10);
    expect(pts).toBe(0);
  });

  test("usuario con apuesta completa también muestra 0 pts sin resultados", async ({ page }) => {
    await loginInBrowser(page, ctx.groupId, ctx.adminUser, ctx.password);
    await page.click('button[role="tab"]:has-text("Ranking")');
    await page.waitForTimeout(1500);

    const rankingTable = page.locator("table");
    await expect(rankingTable).toBeVisible({ timeout: 10000 });

    const adminRow = rankingTable.locator(`tr:has-text("${ctx.adminUser}")`);
    await expect(adminRow).toBeVisible({ timeout: 5000 });

    const ptsCell = adminRow.locator("td.pts-cell, td:nth-child(3)");
    const ptsText = await ptsCell.first().textContent();
    const pts = parseInt(ptsText.trim(), 10);
    expect(pts).toBe(0);
  });
});
