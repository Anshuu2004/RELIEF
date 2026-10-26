// Shared setup for the e2e specs.
//
// Every test runs with the network closed: anything that is not served from the
// local static server (Firebase, fonts, CDN icons, Leaflet, map tiles, Nominatim)
// is aborted, so no test can reach a real service. window.open is replaced with a
// recorder so nothing can open a tel: or sms: link or a new tab.
const base = require('@playwright/test');

const LOCAL_HOST = '127.0.0.1';

const test = base.test.extend({
  guards: [async ({ context }, use) => {
    await context.route(
      (url) => /^https?:$/.test(url.protocol) && url.hostname !== LOCAL_HOST,
      (route) => route.abort()
    );
    await context.addInitScript(() => {
      window.__opened = [];
      window.open = (...args) => {
        window.__opened.push(args);
        return null;
      };
    });
    await use();
  }, { auto: true }]
});

/**
 * Replaces navigator.geolocation before the page scripts run.
 * behaviour: { position: { latitude, longitude } } or { error: 1 | 2 | 3 }
 * (the error number is the GeolocationPositionError code, 1 = permission denied).
 */
async function stubGeolocation(page, behaviour) {
  await page.addInitScript((b) => {
    const geolocation = {
      getCurrentPosition(onSuccess, onError) {
        setTimeout(() => {
          if (b.position) {
            onSuccess({
              coords: {
                latitude: b.position.latitude,
                longitude: b.position.longitude,
                accuracy: 25
              },
              timestamp: Date.now()
            });
          } else if (onError) {
            onError({ code: b.error || 2, message: 'stubbed geolocation error' });
          }
        }, 0);
      },
      watchPosition() { return 0; },
      clearWatch() {}
    };
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: geolocation });
  }, behaviour);
}

/** The home page hides its content behind a splash screen for about 3.5 seconds. */
async function openHome(page) {
  await page.goto('/index.html');
  await base.expect(page.locator('.splash-screen')).toHaveCount(0, { timeout: 15000 });
}

const TEST_USER = {
  name: 'Test Person',
  email: 'test.person@example.com',
  password: 'e2e-test-pass'
};

/** Creates a demo account through the real signup form and waits for the dashboard. */
async function signUp(page, user = TEST_USER) {
  await page.goto('/pages/signup.html');
  await page.locator('#signup-name').fill(user.name);
  await page.locator('#signup-email').fill(user.email);
  await page.locator('#signup-password').fill(user.password);
  await page.locator('#signup-confirm-password').fill(user.password);
  await page.locator('#terms').check();
  await page.locator('#signup-form button[type="submit"]').click();
  await page.waitForURL('**/pages/dashboard.html');
}

module.exports = {
  test,
  expect: base.expect,
  stubGeolocation,
  openHome,
  signUp,
  TEST_USER
};
