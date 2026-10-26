const { test, expect, signUp, TEST_USER } = require('./fixtures');

// No auth service is reachable in these tests (all outside hosts are blocked).
// The pages run in demo mode on the local host, which keeps accounts in
// localStorage, so signup/login here go through that demo store.

test.describe('signup, login and logout', () => {
  test('signup creates a demo account and lands on the dashboard', async ({ page }) => {
    await page.goto('/pages/signup.html');
    await expect(page.locator('#demo-notice')).toBeVisible();
    await expect(page.locator('#demo-notice')).toContainText('Demo mode');

    await signUp(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Your Health Continuity Center' })).toBeVisible();

    const stored = await page.evaluate(() => ({
      sessions: JSON.parse(localStorage.getItem('relief_auth_sessions') || '[]'),
      users: localStorage.getItem('relief_demo_users') || ''
    }));
    expect(stored.sessions).toHaveLength(1);
    expect(stored.sessions[0].user.email).toBe(TEST_USER.email);
    // only a salted hash is kept, never the password itself
    expect(stored.users).toContain(TEST_USER.email);
    expect(stored.users).not.toContain(TEST_USER.password);
  });

  test('signup refuses passwords that do not match', async ({ page }) => {
    await page.goto('/pages/signup.html');
    await page.locator('#signup-name').fill(TEST_USER.name);
    await page.locator('#signup-email').fill(TEST_USER.email);
    await page.locator('#signup-password').fill(TEST_USER.password);
    await page.locator('#signup-confirm-password').fill('something-else-1');
    await page.locator('#terms').check();
    await page.locator('#signup-form button[type="submit"]').click();

    await expect(page.locator('.alert-danger')).toHaveText('Passwords do not match.');
    await expect(page).toHaveURL(/\/pages\/signup\.html$/);
    const sessions = await page.evaluate(() => localStorage.getItem('relief_auth_sessions'));
    expect(sessions).toBeNull();
  });

  test('login rejects a wrong password and accepts the right one', async ({ page }) => {
    await signUp(page);
    // start from a signed-out browser that still has the account
    await page.evaluate(() => localStorage.removeItem('relief_auth_sessions'));

    await page.goto('/pages/login.html');
    await page.locator('#login-email').fill(TEST_USER.email);
    await page.locator('#login-password').fill('not-the-password');
    await page.locator('#login-form button[type="submit"]').click();
    await expect(page.locator('.alert-danger')).toHaveText('Invalid email or password.');
    await expect(page).toHaveURL(/\/pages\/login\.html$/);

    await page.locator('#login-password').fill(TEST_USER.password);
    await page.locator('#login-form button[type="submit"]').click();
    await expect(page.locator('.alert-success')).toContainText('Login successful');
    await page.waitForURL('**/pages/dashboard.html');
    await expect(page.getByRole('heading', { level: 1, name: 'Your Health Continuity Center' })).toBeVisible();
  });

  test('login with an unknown email is rejected', async ({ page }) => {
    await page.goto('/pages/login.html');
    await page.locator('#login-email').fill('nobody@example.com');
    await page.locator('#login-password').fill('whatever-123');
    await page.locator('#login-form button[type="submit"]').click();
    await expect(page.locator('.alert-danger')).toHaveText('Invalid email or password.');
    await expect(page).toHaveURL(/\/pages\/login\.html$/);
  });

  test('signed-in header shows Dashboard and Logout, and logout clears the session', async ({ page }) => {
    await signUp(page);

    // a page under /pages/ sends logout to ../index.html, so the URL really changes
    await page.goto('/pages/ambulances.html');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.locator('.btn-dashboard')).toBeVisible();
    await expect(nav.locator('.btn-login')).toBeHidden();
    await expect(nav.locator('.btn-signup')).toBeHidden();

    await nav.getByRole('button', { name: 'Logout' }).click();
    await page.waitForURL('**/index.html');
    await expect(page.locator('.splash-screen')).toHaveCount(0, { timeout: 15000 });

    await expect(page.locator('.navbar .btn-login')).toBeVisible();
    await expect(page.locator('.navbar .btn-signup')).toBeVisible();
    await expect(page.locator('.navbar .user-menu')).toBeHidden();
    const sessions = await page.evaluate(() => localStorage.getItem('relief_auth_sessions'));
    expect(sessions).toBeNull();
  });

  // dashboard.html does not check for a session today, so a signed-out visitor
  // can open it. Switch this on when a guard is added.
  test.fixme('signed-out visitor is sent to login when opening the dashboard', async ({ page }) => {
    await page.goto('/pages/dashboard.html');
    await expect(page).toHaveURL(/\/pages\/login\.html/);
  });
});
