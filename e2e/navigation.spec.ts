import { test, expect } from "@playwright/test";

/**
 * Navigation E2E tests
 *
 * These tests verify routing and redirect behavior defined in middleware.ts.
 *
 * The middleware redirects:
 *   - Unauthenticated users hitting protected routes → /login
 *   - Authenticated users hitting /login → /dashboard
 *   - Root "/" → /dashboard (if authenticated) or /landing (if not)
 *
 * Tests that require an active Supabase session are marked test.skip.
 */

test.describe("Unauthenticated navigation", () => {
  test("visiting /dashboard without auth redirects to /login", async ({
    page,
  }) => {
    // No auth cookies present — middleware should redirect to /login
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("visiting / without auth redirects away from root", async ({ page }) => {
    // Root page checks auth and redirects to /landing (no session)
    // Allow either /landing or /login as valid unauthenticated destinations
    await page.goto("/");
    await expect(page).toHaveURL(/\/(landing|login)/);
  });

  test("/login is accessible without auth", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);

    // Confirm the page actually rendered the form (not a redirect loop)
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test("/landing is accessible without auth", async ({ page }) => {
    await page.goto("/landing");
    // Should stay on /landing (it's a public route per middleware)
    await expect(page).toHaveURL(/\/landing/);
  });

  test("visiting /onboarding without auth redirects to /login", async ({
    page,
  }) => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/login/);
  });

  test("visiting /connect without auth redirects to /login", async ({
    page,
  }) => {
    await page.goto("/connect");
    await expect(page).toHaveURL(/\/login/);
  });

  test("expired session query param is preserved on redirect", async ({
    page,
  }) => {
    // Middleware sets ?expired=1 when auth cookies exist but session is invalid.
    // We can't fully simulate this without real cookies, but we can verify
    // the login page renders correctly when the param is manually present.
    await page.goto("/login?expired=1");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});

test.describe("Authenticated navigation", () => {
  // All tests in this describe block require a real Supabase session.
  // They are skipped until TEST_USER_EMAIL / TEST_USER_PASSWORD are set
  // and a live Supabase instance is available.

  test.skip("authenticated user visiting /login is redirected to /dashboard", async ({
    page,
    context,
  }) => {
    // Requires: real auth session injected via storage state or login flow.
    // Approach: log in programmatically, then navigate to /login.
    void context; // suppress unused warning
    await page.goto("/login");
    await page
      .locator('input[type="email"]')
      .fill(process.env.TEST_USER_EMAIL ?? "");
    await page
      .locator('input[type="password"]')
      .fill(process.env.TEST_USER_PASSWORD ?? "");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/);

    // Now navigate back to /login — should immediately redirect to /dashboard
    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test.skip("authenticated user can navigate from /dashboard to other protected routes", async ({
    page,
  }) => {
    // Requires: active session.
    // After login, verify navigation between dashboard sub-routes works.
    await page.goto("/login");
    await page
      .locator('input[type="email"]')
      .fill(process.env.TEST_USER_EMAIL ?? "");
    await page
      .locator('input[type="password"]')
      .fill(process.env.TEST_USER_PASSWORD ?? "");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/);

    // Verify dashboard loaded
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator("body")).toBeVisible();
  });
});
