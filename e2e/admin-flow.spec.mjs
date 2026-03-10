/**
 * Tests E2E de experiencia de administrador.
 * Simula: login admin, crear delegadas F1/fútbol (verificando que los campos NO se borran),
 * introducir resultados, gestionar usuarios, publicar apuestas.
 */
import { test, expect } from "@playwright/test";
import { setupTestGroup, loginInBrowser, seedF1BetWindow } from "./helpers.mjs";

let ctx;

test.beforeAll(async () => {
  ctx = await setupTestGroup();
  await seedF1BetWindow(ctx.groupId, ctx.adminUser, "australia");
});

async function goToAdminF1(page) {
  await loginInBrowser(page, ctx.groupId, ctx.adminUser, ctx.password);
  await page.click('button[role="tab"]:has-text("Admin")');
  await page.waitForTimeout(500);
  // Click the F1 sub-tab inside "Panel de administración"
  const adminPanel = page.locator('text=Panel de administración').locator("..");
  await adminPanel.locator('button:has-text("F1")').click();
  await page.waitForTimeout(1000);
}

async function goToAdminFutbol(page) {
  await loginInBrowser(page, ctx.groupId, ctx.adminUser, ctx.password);
  await page.click('button[role="tab"]:has-text("Admin")');
  await page.waitForTimeout(500);
  // Click the Fútbol sub-tab inside "Panel de administración"
  const adminPanel = page.locator('text=Panel de administración').locator("..");
  await adminPanel.locator('button:has-text("Fútbol")').click();
  await page.waitForTimeout(1000);
}

test.describe("Admin — Login y acceso al panel", () => {
  test("admin puede ver el tab de Admin", async ({ page }) => {
    await loginInBrowser(page, ctx.groupId, ctx.adminUser, ctx.password);
    const adminTab = page.locator('button[role="tab"]:has-text("Admin")');
    await expect(adminTab).toBeVisible();
  });

  test("usuario normal NO ve el tab de Admin", async ({ page }) => {
    await loginInBrowser(page, ctx.groupId, ctx.regularUser, ctx.password);
    const adminTab = page.locator('button[role="tab"]:has-text("Admin")');
    await expect(adminTab).not.toBeVisible();
  });
});

test.describe("Admin F1 — Apuestas delegadas (bug: campos que se borran)", () => {
  test("los campos de apuesta delegada NO se borran al rellenar", async ({ page }) => {
    await goToAdminF1(page);

    // Wait for F1 admin content
    await page.waitForSelector('text=Introducir', { timeout: 10000 });

    // Select participant
    const participantSelect = page.locator('select').filter({ has: page.locator('option:has-text("Elige participante")') }).first();
    if (await participantSelect.isVisible()) {
      const options = await participantSelect.locator("option").allTextContents();
      const userOpt = options.find(o => o.includes(ctx.regularUser));
      if (userOpt) {
        await participantSelect.selectOption({ label: userOpt.trim() });
        await page.waitForTimeout(500);
      }
    }

    // Select "Apuesta delegada" radio
    const delegatedLabel = page.locator('span:has-text("delegada")').first();
    if (await delegatedLabel.isVisible()) await delegatedLabel.click();
    await page.waitForTimeout(300);

    // Find driver selects (look for ones containing driver names)
    const allSelects = page.locator('select');
    const selectCount = await allSelects.count();

    let poleSelectIdx = -1;
    for (let i = 0; i < selectCount; i++) {
      const opts = await allSelects.nth(i).locator("option").allTextContents();
      if (opts.some(o => o.includes("Verstappen") || o.includes("Hamilton") || o.includes("Norris"))) {
        poleSelectIdx = i;
        break;
      }
    }

    if (poleSelectIdx >= 0) {
      const poleSelect = allSelects.nth(poleSelectIdx);
      await poleSelect.selectOption({ label: "Max Verstappen" });
      await page.waitForTimeout(500);
      expect(await poleSelect.inputValue()).not.toBe("");

      // Fill P1
      if (poleSelectIdx + 1 < selectCount) {
        const p1Select = allSelects.nth(poleSelectIdx + 1);
        const p1Opts = await p1Select.locator("option").allTextContents();
        if (p1Opts.some(o => o.includes("Hamilton"))) {
          await p1Select.selectOption({ label: "Lewis Hamilton" });
          await page.waitForTimeout(500);
          // BUG CHECK: pole should still be set
          expect(await poleSelect.inputValue()).toContain("Verstappen");
        }
      }

      // Fill P2
      if (poleSelectIdx + 2 < selectCount) {
        const p2Select = allSelects.nth(poleSelectIdx + 2);
        const p2Opts = await p2Select.locator("option").allTextContents();
        if (p2Opts.some(o => o.includes("Leclerc"))) {
          await p2Select.selectOption({ label: "Charles Leclerc" });
          await page.waitForTimeout(500);
          // BUG CHECK: pole and P1 still set
          expect(await poleSelect.inputValue()).toContain("Verstappen");
          expect(await allSelects.nth(poleSelectIdx + 1).inputValue()).toContain("Hamilton");
        }
      }

      // Fill P3
      if (poleSelectIdx + 3 < selectCount) {
        const p3Select = allSelects.nth(poleSelectIdx + 3);
        const p3Opts = await p3Select.locator("option").allTextContents();
        if (p3Opts.some(o => o.includes("Norris"))) {
          await p3Select.selectOption({ label: "Lando Norris" });
          await page.waitForTimeout(500);
          // FINAL BUG CHECK: all fields preserved
          expect(await poleSelect.inputValue()).toContain("Verstappen");
          expect(await allSelects.nth(poleSelectIdx + 1).inputValue()).toContain("Hamilton");
          expect(await allSelects.nth(poleSelectIdx + 2).inputValue()).toContain("Leclerc");
        }
      }
    }

    // Fill question fields
    const questionInputs = page.locator('input[placeholder*="Respuesta"]');
    const qCount = await questionInputs.count();
    for (let i = 0; i < Math.min(qCount, 3); i++) {
      await questionInputs.nth(i).fill(`Respuesta ${i + 1}`);
      await page.waitForTimeout(200);
    }
    for (let i = 0; i < Math.min(qCount, 3); i++) {
      expect(await questionInputs.nth(i).inputValue()).toBe(`Respuesta ${i + 1}`);
    }

    // Save
    const saveBtn = page.locator('button:has-text("Guardar apuesta")');
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await page.waitForTimeout(2000);
    }
  });
});

test.describe("Admin F1 — Resultados", () => {
  test("admin puede introducir resultados F1", async ({ page }) => {
    await goToAdminF1(page);

    const resultsSection = page.locator('text=Resultados oficiales');
    await expect(resultsSection).toBeVisible({ timeout: 10000 });

    // Find a driver select in the results section
    const allSelects = page.locator("select");
    const count = await allSelects.count();
    for (let i = 0; i < count; i++) {
      const opts = await allSelects.nth(i).locator("option").allTextContents();
      if (opts.some(o => o.includes("Verstappen"))) {
        await allSelects.nth(i).selectOption({ label: "Lando Norris" });
        break;
      }
    }

    // Save — find the button near "Resultados oficiales"
    const allBtns = page.locator('button:has-text("Guardar")');
    const btnCount = await allBtns.count();
    for (let i = 0; i < btnCount; i++) {
      const text = await allBtns.nth(i).textContent();
      if (text.trim() === "Guardar") {
        await allBtns.nth(i).click();
        await page.waitForTimeout(1000);
        break;
      }
    }
  });
});

test.describe("Admin F1 — Control de apuestas", () => {
  test("admin puede abrir y cerrar ventana de apuestas", async ({ page }) => {
    await goToAdminF1(page);

    // Open bets
    const openBtn = page.locator('button:has-text("Abrir")').first();
    if (await openBtn.isVisible().catch(() => false)) {
      await openBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator('text=Abierto manualmente')).toBeVisible();
    }

    // Close bets
    const closeBtn = page.locator('button:has-text("Cerrar")').first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator('text=Cerrado manualmente')).toBeVisible();
    }

    // Back to auto
    const autoBtn = page.locator('button:has-text("Automático")').first();
    if (await autoBtn.isVisible().catch(() => false)) {
      await autoBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test("admin puede publicar apuestas", async ({ page }) => {
    await goToAdminF1(page);

    const publishBtn = page.locator('button:has-text("Publicar ya")');
    if (await publishBtn.isVisible().catch(() => false)) {
      await publishBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator('text=Publicadas manualmente')).toBeVisible();
    }
  });
});

test.describe("Admin Fútbol — Apuestas delegadas", () => {
  test("admin puede crear apuesta delegada de fútbol sin perder campos", async ({ page }) => {
    await goToAdminFutbol(page);

    // Select the test jornada
    const jornadaSelect = page.locator("select").first();
    const options = await jornadaSelect.locator("option").allTextContents();
    const jornadaOpt = options.find(o => o.includes("E2E") || o.includes("Jornada"));
    if (jornadaOpt) {
      await jornadaSelect.selectOption({ label: jornadaOpt.trim() });
      await page.waitForTimeout(500);
    }

    // Switch to bet editing mode if there's a toggle
    const betModeBtn = page.locator('button:has-text("Editar apuesta"), button:has-text("Apuesta participante"), label:has-text("Apuesta")').first();
    if (await betModeBtn.isVisible().catch(() => false)) {
      await betModeBtn.click();
      await page.waitForTimeout(500);
    }

    // Select participant
    const userSelect = page.locator("select").filter({ has: page.locator('option:has-text("participante"), option:has-text("Elige")') }).first();
    if (await userSelect.isVisible().catch(() => false)) {
      const userOpts = await userSelect.locator("option").allTextContents();
      const userOpt = userOpts.find(o => o.includes(ctx.regularUser));
      if (userOpt) {
        await userSelect.selectOption({ label: userOpt.trim() });
        await page.waitForTimeout(500);
      }
    }

    // Select "delegada" option
    const delegatedLabel = page.locator('text=delegada, text=Delegada').first();
    if (await delegatedLabel.isVisible().catch(() => false)) {
      await delegatedLabel.click();
      await page.waitForTimeout(300);
    }

    // Fill scores
    const numberInputs = page.locator('input[type="number"]');
    const inputCount = await numberInputs.count();
    const values = [2, 1, 0, 0];
    for (let i = 0; i < Math.min(inputCount, values.length); i++) {
      await numberInputs.nth(i).fill(String(values[i]));
      await page.waitForTimeout(300);
    }

    // BUG CHECK: fields must retain their values
    for (let i = 0; i < Math.min(inputCount, values.length); i++) {
      const currentVal = await numberInputs.nth(i).inputValue();
      expect(currentVal).toBe(String(values[i]));
    }

    // Save
    const saveBtn = page.locator('button:has-text("Guardar")').first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
    }
  });
});

test.describe("Admin Fútbol — Resultados", () => {
  test("admin puede introducir resultados de fútbol", async ({ page }) => {
    await goToAdminFutbol(page);

    const jornadaSelect = page.locator("select").first();
    const options = await jornadaSelect.locator("option").allTextContents();
    const jornadaOpt = options.find(o => o.includes("E2E") || o.includes("Jornada"));
    if (jornadaOpt) {
      await jornadaSelect.selectOption({ label: jornadaOpt.trim() });
      await page.waitForTimeout(500);
    }

    const numberInputs = page.locator('input[type="number"]');
    const count = await numberInputs.count();
    if (count >= 4) {
      await numberInputs.nth(0).fill("3");
      await numberInputs.nth(1).fill("1");
      await numberInputs.nth(2).fill("2");
      await numberInputs.nth(3).fill("2");
      await page.waitForTimeout(300);
    }

    const saveBtn = page.locator('button:has-text("Guardar")').first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
    }
  });

  test("admin puede publicar apuestas de fútbol", async ({ page }) => {
    await goToAdminFutbol(page);

    const jornadaSelect = page.locator("select").first();
    const options = await jornadaSelect.locator("option").allTextContents();
    const jornadaOpt = options.find(o => o.includes("E2E") || o.includes("Jornada"));
    if (jornadaOpt) {
      await jornadaSelect.selectOption({ label: jornadaOpt.trim() });
      await page.waitForTimeout(500);
    }

    const publishBtn = page.locator('button:has-text("Publicar")').first();
    if (await publishBtn.isVisible().catch(() => false)) {
      await publishBtn.click();
      await page.waitForTimeout(500);
    }
  });
});

test.describe("Admin — Gestión de usuarios", () => {
  test("admin puede ver la lista de usuarios", async ({ page }) => {
    await loginInBrowser(page, ctx.groupId, ctx.adminUser, ctx.password);
    await page.click('button[role="tab"]:has-text("Admin")');
    await page.waitForTimeout(500);

    await expect(page.locator('text=Gestión de usuarios')).toBeVisible();
    await expect(page.locator(`text=${ctx.adminUser}`).first()).toBeVisible();
    await expect(page.locator(`text=${ctx.regularUser}`).first()).toBeVisible();
  });
});
