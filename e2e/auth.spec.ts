import { test, expect } from "@playwright/test";

/**
 * Auth E2E tests
 *
 * Tests that do not require real Supabase credentials are marked as runnable.
 * Tests that require a live Supabase instance (actual sign-in/sign-up flows)
 * are marked test.skip — they need real credentials and a running Supabase project.
 */

test.describe("Login page", () => {
  test("login page loads at /login", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login form renders email input, password input, and submit button", async ({
    page,
  }) => {
    await page.goto("/login");

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
  });

  test("login form shows Sign In heading by default", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h1")).toHaveText("Sign In");
  });

  test("toggle to sign up mode shows Create Account heading", async ({
    page,
  }) => {
    await page.goto("/login");

    // Click the toggle button to switch to sign-up mode
    const toggleButton = page.locator(
      'button:has-text("Don\'t have an account? Sign up")'
    );
    await toggleButton.click();

    await expect(page.locator("h1")).toHaveText("Create Account");
  });

  test("forgot password link is visible in sign-in mode", async ({ page }) => {
    await page.goto("/login");
    const forgotLink = page.locator('a[href="/reset-password"]');
    await expect(forgotLink).toBeVisible();
    await expect(forgotLink).toHaveText("Forgot password?");
  });

  test("forgot password link is hidden in sign-up mode", async ({ page }) => {
    await page.goto("/login");

    const toggleButton = page.locator(
      'button:has-text("Don\'t have an account? Sign up")'
    );
    await toggleButton.click();

    const forgotLink = page.locator('a[href="/reset-password"]');
    await expect(forgotLink).not.toBeVisible();
  });

  test("email input enforces required validation on empty submit", async ({
    page,
  }) => {
    await page.goto("/login");

    // Submit with no values — browser HTML5 validation should block submission
    await page.locator('button[type="submit"]').click();

    // The email field should still be focused / form should not have navigated away
    await expect(page).toHaveURL(/\/login/);
  });

  test("password input enforces minLength=6 on short password", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.locator('input[type="email"]').fill("test@example.com");
    await page.locator('input[type="password"]').fill("abc"); // too short

    await page.locator('button[type="submit"]').click();

    // Browser validation should prevent navigation
    await expect(page).toHaveURL(/\/login/);
  });

  // --- Tests below require a live Supabase instance ---

  test.skip("valid credentials redirect to /dashboard", async ({ page }) => {
    // Requires: real Supabase project URL, anon key, and a test user account.
    // Set TEST_USER_EMAIL and TEST_USER_PASSWORD env vars to enable.
    await page.goto("/login");
    await page
      .locator('input[type="email"]')
      .fill(process.env.TEST_USER_EMAIL ?? "");
    await page
      .locator('input[type="password"]')
      .fill(process.env.TEST_USER_PASSWORD ?? "");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test.skip("invalid credentials show error toast", async ({ page }) => {
    // Requires: live Supabase instance to return an auth error response.
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("wrong@example.com");
    await page.locator('input[type="password"]').fill("wrongpassword");
    await page.locator('button[type="submit"]').click();

    // Toast error should appear
    const toast = page.locator('[role="alert"]');
    await expect(toast).toBeVisible({ timeout: 5000 });
  });
});
