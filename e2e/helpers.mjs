/**
 * Helpers compartidos para los tests E2E.
 */

if (!process.env.E2E_BASE_URL) throw new Error("E2E_BASE_URL env var is required");
const API_BASE = process.env.E2E_BASE_URL;
// SHA-256 of "test123"
const PASSWORD_HASH = "ecd71870d1963316a97e3ac3408c9835ad8cf0f3c1bc703527c30265534f75ae";
const PASSWORD = "test123";

async function apiCall(method, path, body, user) {
  const h = { "Content-Type": "application/json", Accept: "application/json" };
  if (user) h["x-porra-user"] = user;
  const opts = { method, headers: h };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${API_BASE}${path}`, opts);
  return r.json();
}

export async function setupTestGroup() {
  const ts = Date.now();
  const adminUser = `Admin_e2e_${ts}`;
  const regularUser = `User_e2e_${ts}`;
  const groupName = `E2E Test ${ts}`;

  const create = await apiCall("POST", "/groups", {
    name: groupName, adminUser, adminPasswordHash: PASSWORD_HASH, sports: ["f1", "futbol"],
  });

  await apiCall("POST", `/groups/${create.groupId}/join`, {
    name: regularUser, passwordHash: PASSWORD_HASH, inviteCode: create.inviteCode,
  });

  const jornadaId = `e2e_j_${ts}`;
  await apiCall("PUT", `/g/${create.groupId}/admin/futbol/${jornadaId}`, {
    type: "jornada",
    data: {
      id: jornadaId, name: "Jornada E2E",
      matches: [
        { home: "Real Madrid", away: "FC Barcelona" },
        { home: "Atlético Madrid", away: "Valencia CF" },
      ],
      deadline: "2027-12-31T23:59:00Z",
      order: [jornadaId],
    },
  }, adminUser);

  await apiCall("PUT", `/g/${create.groupId}/admin/futbol/${jornadaId}`, {
    type: "window", data: { forceOpen: true },
  }, adminUser);

  return {
    groupId: create.groupId,
    inviteCode: create.inviteCode,
    groupName,
    adminUser,
    regularUser,
    password: PASSWORD,
    jornadaId,
  };
}

export async function loginInBrowser(page, groupId, userName, password) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });

  await page.goto("/#/", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#login-user", { timeout: 15000 });

  await page.fill("#login-user", userName);
  await page.fill("#login-pass", password);
  await page.click('button:has-text("ENTRAR")');

  // Wait for redirect to group, retrying if needed
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await page.waitForFunction(
        () => window.location.hash.includes("/g/"),
        { timeout: 12000 }
      );
      break;
    } catch {
      const hasLoginForm = await page.locator("#login-user").isVisible().catch(() => false);
      if (hasLoginForm) {
        await page.fill("#login-user", userName);
        await page.fill("#login-pass", password);
        await page.click('button:has-text("ENTRAR")');
      }
    }
  }

  // Wait for app to fully load (state fetch from API)
  await page.waitForSelector('nav[role="tablist"]', { timeout: 30000 });
}

export async function seedF1BetWindow(groupId, adminUser, raceKey) {
  await apiCall("PUT", `/g/${groupId}/admin/f1/${raceKey}`, {
    type: "window", data: { forceOpen: true },
  }, adminUser);
}

export async function seedF1Reveal(groupId, adminUser, raceKey) {
  await apiCall("PUT", `/g/${groupId}/admin/f1/${raceKey}`, {
    type: "reveal", data: { forceShow: true },
  }, adminUser);
}

export async function seedF1Questions(groupId, adminUser, raceKey, questions) {
  await apiCall("PUT", `/g/${groupId}/admin/f1/${raceKey}`, {
    type: "questions",
    data: {
      questions: { [raceKey]: questions },
      questionsStatus: { [raceKey]: { published: true, author: adminUser, publishedAt: new Date().toISOString() } },
      questionOwner: { [raceKey]: adminUser },
    },
  }, adminUser);
}

export async function seedF1Bet(groupId, user, raceKey, bet) {
  await apiCall("PUT", `/g/${groupId}/admin/f1/${raceKey}`, {
    type: "bet",
    data: { userName: user, bet },
  }, user);
}

export async function seedFutbolReveal(groupId, adminUser, jornadaId) {
  await apiCall("PUT", `/g/${groupId}/admin/futbol/${jornadaId}`, {
    type: "reveal", data: { forceShow: true },
  }, adminUser);
}
