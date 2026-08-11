import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

await page.goto("http://localhost:3000/admin/login");
await page.fill('input[type="password"], input[name="password"]', "DiscGolfDieppe");
await page.click('button[type="submit"]');
await page.waitForURL(/\/admin/, { timeout: 10000 });

await page.goto("http://localhost:3000/admin/leagues");
await page.waitForLoadState("networkidle");
const leagueLink = page.locator('a[href*="/admin/leagues/"]').first();
const leagueHref = await leagueLink.getAttribute("href");
console.log("league href", leagueHref);

await page.goto(`http://localhost:3000${leagueHref}`);
await page.waitForLoadState("networkidle");
const roundLink = page.locator('a[href*="/rounds/"]').first();
const roundHref = await roundLink.getAttribute("href");
console.log("round href", roundHref);

await page.goto(`http://localhost:3000${roundHref}`);
await page.waitForLoadState("networkidle");

const heading = page.locator('text=Sign-In, Payment & Tags');
await heading.scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
await page.screenshot({ path: "/private/tmp/claude-502/-Users-danielarseneault-Dev-DiscGolfDieppeLeagueStats/3e3abc75-30af-4ba3-8c84-1b9301a7735b/scratchpad/table.png", fullPage: false });

await browser.close();
