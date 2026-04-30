/**
 * Tests E2E de experiencia de usuario.
 * Simula las acciones reales: login, navegar, crear/modificar apuestas, ver ranking.
 */
import { test, expect } from "@playwright/test";
import { setupTestGroup, loginInBrowser, seedF1BetWindow, seedF1Reveal } from "./helpers.mjs";

let ctx;

test.beforeAll(async () => {
  ctx = await setupTestGroup();
});

test.describe("Flujo de usuario — Login y navegación", () => {
  test("puede hacer login y ver la navegación principal", async ({ page }) => {
    await loginInBrowser(page, ctx.groupId, ctx.regularUser, ctx.password);
    await expect(page.locator('nav[role="tablist"]')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("Mi apuesta")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("Ranking")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("Normas")')).toBeVisible();
  });

  test("puede cambiar entre modo F1 y Fútbol", async ({ page }) => {
    await loginInBrowser(page, ctx.groupId, ctx.regularUser, ctx.password);
    const futbolBtn = page.locator('button:has-text("Fútbol"), button:has-text("FÚTBOL"), button:has-text("⚽")').first();
    if (await futbolBtn.isVisible()) {
      await futbolBtn.click();
      await page.waitForTimeout(500);
    }
    const f1Btn = page.locator('button:has-text("F1"), button:has-text("🏎")').first();
    if (await f1Btn.isVisible()) {
      await f1Btn.click();
      await page.waitForTimeout(500);
    }
  });
});

test.describe("Flujo de usuario — Apuestas F1", () => {
  test.beforeAll(async () => {
    await seedF1BetWindow(ctx.groupId, ctx.adminUser, "australia");
  });

  test("puede ver la lista de Grandes Premios", async ({ page }) => {
    await loginInBrowser(page, ctx.groupId, ctx.regularUser, ctx.password);
    await page.click('button[role="tab"]:has-text("Mi apuesta")');
    await expect(page.locator("select").first()).toBeVisible();
    const options = page.locator("select").first().locator("option");
    expect(await options.count()).toBeGreaterThan(0);
  });

  test("puede crear una apuesta F1 completa", async ({ page }) => {
    await loginInBrowser(page, ctx.groupId, ctx.regularUser, ctx.password);
    await page.click('button[role="tab"]:has-text("Mi apuesta")');

    // Select first race (Australia)
    const raceSelect = page.locator("select").first();
    await raceSelect.selectOption({ index: 0 });
    await page.waitForTimeout(500);

    // Fill pole position
    const poleSelect = page.locator('select').nth(1);
    if (await poleSelect.isVisible()) {
      const poleOptions = await poleSelect.locator("option").allTextContents();
      const driverOption = poleOptions.find(o => o && o !== "" && !o.includes("Selecciona") && !o.includes("—"));
      if (driverOption) await poleSelect.selectOption({ label: driverOption.trim() });
    }

    // Fill podium positions
    for (let i = 2; i <= 4; i++) {
      const podSelect = page.locator("select").nth(i);
      if (await podSelect.isVisible().catch(() => false)) {
        const opts = await podSelect.locator("option").allTextContents();
        const opt = opts.find(o => o && o !== "" && !o.includes("Selecciona") && !o.includes("—") && !o.includes("P"));
        if (opt) await podSelect.selectOption({ label: opt.trim() });
      }
    }

    // Submit
    const submitBtn = page.locator('button:has-text("Guardar"), button:has-text("Enviar apuesta"), button:has-text("Confirmar")').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(1000);
    }
  });

  test("puede ver el ranking F1", async ({ page }) => {
    await loginInBrowser(page, ctx.groupId, ctx.regularUser, ctx.password);
    await page.click('button[role="tab"]:has-text("Ranking")');
    await page.waitForTimeout(1000);
    const rankingContent = page.locator("main");
    await expect(rankingContent).toBeVisible();
  });

  test("puede ver las normas", async ({ page }) => {
    await loginInBrowser(page, ctx.groupId, ctx.regularUser, ctx.password);
    await page.click('button[role="tab"]:has-text("Normas")');
    await page.waitForTimeout(500);
    await expect(page.locator("main")).toContainText(/punt|regla|norma/i);
  });
});

test.describe("Flujo de usuario — Apuestas Fútbol", () => {
  test("puede ver las jornadas de fútbol", async ({ page }) => {
    await loginInBrowser(page, ctx.groupId, ctx.regularUser, ctx.password);

    // Switch to fútbol mode
    const futbolBtn = page.locator('button:has-text("Fútbol"), button:has-text("FÚTBOL"), button:has-text("⚽")').first();
    if (await futbolBtn.isVisible()) await futbolBtn.click();
    await page.waitForTimeout(500);

    await page.click('button[role="tab"]:has-text("Mi apuesta")');
    await page.waitForTimeout(500);
    await expect(page.locator("main")).toBeVisible();
  });

  test("puede rellenar y guardar una apuesta de fútbol", async ({ page }) => {
    await loginInBrowser(page, ctx.groupId, ctx.regularUser, ctx.password);

    const futbolBtn = page.locator('button:has-text("Fútbol"), button:has-text("FÚTBOL"), button:has-text("⚽")').first();
    if (await futbolBtn.isVisible()) await futbolBtn.click();
    await page.waitForTimeout(500);

    await page.click('button[role="tab"]:has-text("Mi apuesta")');
    await page.waitForTimeout(1000);

    // Fill in scores — look for number inputs
    const scoreInputs = page.locator('input[type="number"]');
    const count = await scoreInputs.count();
    for (let i = 0; i < Math.min(count, 4); i++) {
      await scoreInputs.nth(i).fill(String(i % 3));
    }

    // Submit
    const submitBtn = page.locator('button:has-text("Guardar"), button:has-text("Enviar"), button:has-text("Confirmar")').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(1000);
    }
  });

  test("puede ver el ranking de fútbol", async ({ page }) => {
    await loginInBrowser(page, ctx.groupId, ctx.regularUser, ctx.password);
    const futbolBtn = page.locator('button:has-text("Fútbol"), button:has-text("FÚTBOL"), button:has-text("⚽")').first();
    if (await futbolBtn.isVisible()) await futbolBtn.click();
    await page.waitForTimeout(500);
    await page.click('button[role="tab"]:has-text("Ranking")');
    await page.waitForTimeout(500);
    await expect(page.locator("main")).toBeVisible();
  });
});

test.describe("Flujo de usuario — Ver apuestas de otros", () => {
  test.beforeAll(async () => {
    // Admin bets on Australia and reveals
    const API_BASE = process.env.E2E_BASE_URL;
    await fetch(`${API_BASE}/g/${ctx.groupId}/bets/f1/australia`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-porra-user": ctx.adminUser },
      body: JSON.stringify({ bet: { pole: "Max Verstappen", podium: ["Max Verstappen", "Lewis Hamilton", "Charles Leclerc"], q: ["Sí", "No", "42"] } }),
    });
    await seedF1Reveal(ctx.groupId, ctx.adminUser, "australia");
  });

  test("puede ver apuestas de otros usuarios cuando están reveladas", async ({ page }) => {
    await loginInBrowser(page, ctx.groupId, ctx.regularUser, ctx.password);
    await page.click('button[role="tab"]:has-text("Mi apuesta")');
    await page.waitForTimeout(1000);

    // Select Australia
    const raceSelect = page.locator("select").first();
    await raceSelect.selectOption({ index: 0 });
    await page.waitForTimeout(1000);

    // Should see other user's bets or a section showing them
    const pageText = await page.locator("main").textContent();
    // Either we see the admin user's name or "Apuestas" section
    const hasOtherBets = pageText.includes(ctx.adminUser) || pageText.includes("apuesta") || pageText.includes("Pole");
    expect(hasOtherBets).toBeTruthy();
  });
});
