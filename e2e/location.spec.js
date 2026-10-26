const { test, expect, stubGeolocation } = require('./fixtures');

// Covers the location panel (assets/js/location-panel.js) on the hospitals page:
// sharing the device position, and the manual place fallback. The facility list
// itself is not checked here.
const PANEL_URL = '/pages/hospitals.html';

function readStoredLocation(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('userLocation')));
}

test.describe('location panel', () => {
  test('a known town can be entered by hand and then cleared', async ({ page }) => {
    await stubGeolocation(page, { error: 1 });
    await page.goto(PANEL_URL);
    await expect(page.locator('#location-current')).toContainText('No location set');
    await expect(page.locator('#location-clear')).toBeHidden();

    await page.locator('#location-input').fill('Kolkata');
    await page.locator('#location-form button[type="submit"]').click();

    await expect(page.locator('#location-current')).toContainText('Using your chosen location: Kolkata');
    await expect(page.locator('#location-clear')).toBeVisible();
    await expect(page.locator('#location-error')).toBeEmpty();
    const saved = await readStoredLocation(page);
    expect(saved).toMatchObject({ source: 'manual', label: 'Kolkata', lat: 22.57, lng: 88.36 });

    await page.locator('#location-clear').click();
    await expect(page.locator('#location-current')).toContainText('No location set');
    expect(await readStoredLocation(page)).toBeNull();
  });

  test('input that is too short is rejected without any lookup', async ({ page }) => {
    await page.goto(PANEL_URL);
    await page.locator('#location-input').fill('ab');
    await page.locator('#location-form button[type="submit"]').click();
    await expect(page.locator('#location-error')).toContainText('Enter a town, village, address or a 6 digit PIN code.');
    await expect(page.locator('#location-current')).toContainText('No location set');
  });

  test('an unknown place shows the network message when the lookup service is unreachable', async ({ page }) => {
    // Anything outside the local host is blocked, so the geocoding request fails.
    await page.goto(PANEL_URL);
    await page.locator('#location-input').fill('Nowhereville Test Road');
    await page.locator('#location-form button[type="submit"]').click();
    await expect(page.locator('#location-error')).toContainText('network is unavailable');
    await expect(page.locator('#location-current')).toContainText('No location set');
    expect(await readStoredLocation(page)).toBeNull();
  });

  test('device location is used and saved when the browser allows it', async ({ page }) => {
    await stubGeolocation(page, { position: { latitude: 22.5726, longitude: 88.3639 } });
    await page.goto(PANEL_URL);
    await page.locator('#location-use-gps').click();

    await expect(page.locator('#location-current')).toContainText('detected location');
    const saved = await readStoredLocation(page);
    expect(saved).toMatchObject({ source: 'gps', lat: 22.57, lng: 88.36 });
  });

  test('a denied permission explains the problem and points to the manual field', async ({ page }) => {
    await stubGeolocation(page, { error: 1 });
    await page.goto(PANEL_URL);
    await page.locator('#location-use-gps').click();

    await expect(page.locator('#location-error')).toContainText('permission was denied');
    await expect(page.locator('#location-input')).toBeFocused();
    await expect(page.locator('#location-current')).toContainText('No location set');
    expect(await readStoredLocation(page)).toBeNull();
  });
});
