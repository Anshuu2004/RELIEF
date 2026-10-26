const { test, expect, stubGeolocation } = require('./fixtures');

// The SOS dialog (assets/js/emergency-sos.js). Nothing here calls a real
// emergency service: there is no endpoint unless a test sets one, and that one
// is a same-origin path answered by a Playwright route. tel: and sms: links are
// only checked for their href, never clicked.
const SOS_URL = '/pages/ambulances.html';
const MOCK_ENDPOINT = '/api/mock-sos';

async function useMockEndpoint(page, respond) {
  const bodies = [];
  await page.addInitScript((endpoint) => {
    window.RELIEF_SOS_ENDPOINT = endpoint;
  }, MOCK_ENDPOINT);
  await page.route(`**${MOCK_ENDPOINT}`, (route) => {
    bodies.push(route.request().postDataJSON());
    return respond(route);
  });
  return bodies;
}

async function openDialog(page) {
  await page.goto(SOS_URL);
  await page.locator('#relief-emergency-sos-trigger').click();
  await expect(page.locator('#relief-sos-dialog')).toBeVisible();
}

async function expectNothingOpened(page) {
  expect(await page.evaluate(() => window.__opened.length)).toBe(0);
}

test.describe('emergency SOS flow', () => {
  test('asks for confirmation first and can be cancelled without sending anything', async ({ page }) => {
    const requests = [];
    page.on('request', (req) => {
      if (req.method() === 'POST') requests.push(req.url());
    });
    await stubGeolocation(page, { error: 1 });
    await openDialog(page);

    await expect(page.locator('#relief-emergency-sos-trigger')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#relief-sos-confirm-btn')).toBeVisible();
    await expect(page.locator('#relief-sos-cancel-btn')).toBeVisible();
    await expect(page.locator('#relief-sos-dialog')).toContainText('CRITICAL SAFETY NOTICE');

    await page.locator('#relief-sos-cancel-btn').click();
    await expect(page.locator('#relief-sos-dialog')).toHaveCount(0);
    await expect(page.locator('#relief-emergency-sos-trigger')).toHaveAttribute('aria-expanded', 'false');
    expect(requests).toEqual([]);
    await expectNothingOpened(page);
  });

  test('Escape closes the confirmation dialog', async ({ page }) => {
    await stubGeolocation(page, { error: 1 });
    await openDialog(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#relief-sos-dialog')).toHaveCount(0);
  });

  test('without a dispatch backend it says nothing was sent and shows the manual options', async ({ page }) => {
    await stubGeolocation(page, { error: 1 });
    await openDialog(page);
    await page.locator('#relief-sos-confirm-btn').click();

    const dialog = page.locator('#relief-sos-dialog');
    await expect(dialog.locator('.relief-sos-status-title')).toHaveText('Web Dispatch Unavailable');
    await expect(dialog).toContainText('No live emergency dispatch backend is configured');
    await expect(dialog).not.toContainText('SOS Request Accepted');
    await expect(page.locator('#relief-sos-retry-btn')).toBeVisible();

    await expect(dialog.locator('a.relief-sos-btn-call').first()).toHaveAttribute('href', 'tel:112');
    await expect(page.locator('#relief-sos-sms-btn')).toHaveAttribute('href', /^sms:112\?body=/);
    await expectNothingOpened(page);
  });

  test('a backend that confirms dispatch is reported as accepted, with the location sent along', async ({ page }) => {
    await stubGeolocation(page, { position: { latitude: 22.5726, longitude: 88.3639 } });
    const bodies = await useMockEndpoint(page, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ delivered: true, requestId: 'mock-request-1' })
    }));
    await openDialog(page);
    await page.locator('#relief-sos-confirm-btn').click();

    const dialog = page.locator('#relief-sos-dialog');
    await expect(dialog.locator('.relief-sos-status-title')).toHaveText('SOS Request Accepted');
    await expect(page.locator('#relief-sos-retry-btn')).toHaveCount(0);

    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({
      urgency: 'HIGH',
      serviceType: 'EMERGENCY_AMBULANCE',
      locationStatus: 'retrieved',
      region: 'IN'
    });
    expect(bodies[0].location.lat).toBeCloseTo(22.5726, 4);
    expect(bodies[0].location.lng).toBeCloseTo(88.3639, 4);

    await page.locator('#relief-sos-close-result-btn').click();
    await expect(page.locator('#relief-sos-dialog')).toHaveCount(0);
    await expectNothingOpened(page);
  });

  test('a server error is never shown as success and can be retried', async ({ page }) => {
    await stubGeolocation(page, { error: 1 });
    const bodies = await useMockEndpoint(page, (route) => route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'down' })
    }));
    await openDialog(page);
    await page.locator('#relief-sos-confirm-btn').click();

    const dialog = page.locator('#relief-sos-dialog');
    await expect(dialog.locator('.relief-sos-status-title')).toHaveText('Web Dispatch Unavailable');
    await expect(dialog).toContainText('HTTP 500');
    await expect(dialog).not.toContainText('SOS Request Accepted');
    expect(bodies).toHaveLength(1);
    expect(bodies[0].locationStatus).toBe('denied');

    await page.locator('#relief-sos-retry-btn').click();
    await expect(dialog).toContainText('HTTP 500');
    await expect.poll(() => bodies.length).toBe(2);
    await expectNothingOpened(page);
  });
});
