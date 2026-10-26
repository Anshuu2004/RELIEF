const { test, expect, openHome } = require('./fixtures');

test.describe('landing page and primary navigation', () => {
  test('home page loads and shows the hero after the splash screen', async ({ page }) => {
    await openHome(page);
    await expect(page).toHaveTitle(/Relief/);
    await expect(page.getByRole('heading', { level: 1, name: 'Your Health, Our Priority' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  });

  const NAV_TARGETS = [
    { name: 'About Us', url: /\/pages\/about\.html$/ },
    { name: 'Contact', url: /\/pages\/contact\.html$/ }
  ];

  for (const target of NAV_TARGETS) {
    test(`"${target.name}" in the main nav opens its page`, async ({ page }) => {
      await openHome(page);
      await page
        .getByRole('navigation', { name: 'Main navigation' })
        .getByRole('link', { name: target.name, exact: true })
        .click();
      await expect(page).toHaveURL(target.url);
    });
  }

  test('Services menu leads to the hospitals page', async ({ page }) => {
    await openHome(page);
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await nav.locator('.dropdown-toggle').hover();
    await nav.locator('.dropdown-menu').getByRole('link', { name: 'Hospitals' }).click();
    await expect(page).toHaveURL(/\/pages\/hospitals\.html$/);
  });

  test('Login and Sign Up links open the auth pages', async ({ page }) => {
    await openHome(page);
    await page.locator('.navbar .btn-login').click();
    await expect(page).toHaveURL(/\/pages\/login\.html$/);
    await expect(page.locator('#login-form')).toBeVisible();

    await page.locator('.navbar .btn-signup').click();
    await expect(page).toHaveURL(/\/pages\/signup\.html$/);
    await expect(page.locator('#signup-form')).toBeVisible();
  });
});

test.describe('responsive navigation', () => {
  test.describe('phone width', () => {
    test.use({ viewport: { width: 375, height: 700 } });

    test('hamburger opens the menu and Escape closes it', async ({ page }) => {
      await page.goto('/pages/login.html');
      const burger = page.getByRole('button', { name: 'Mobile menu' });
      const menu = page.locator('#main-nav-links');
      const homeLink = menu.getByRole('link', { name: 'Home' });

      await expect(burger).toBeVisible();
      await expect(burger).toHaveAttribute('aria-expanded', 'false');
      await expect(menu).not.toHaveClass(/active/);
      await expect(homeLink).toBeHidden();

      await burger.click();
      await expect(burger).toHaveAttribute('aria-expanded', 'true');
      await expect(menu).toHaveClass(/active/);
      await expect(homeLink).toBeVisible();

      // The open menu panel sits over the hamburger on this page, so close with the keyboard.
      await page.keyboard.press('Escape');
      await expect(burger).toHaveAttribute('aria-expanded', 'false');
      await expect(menu).not.toHaveClass(/active/);
      await expect(homeLink).toBeHidden();
      await expect(burger).toBeFocused();
    });
  });

  test('hamburger is hidden at desktop width', async ({ page }) => {
    await page.goto('/pages/login.html');
    await expect(page.locator('#login-form')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mobile menu' })).toBeHidden();
  });
});
