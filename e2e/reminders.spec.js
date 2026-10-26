const { test, expect } = require('./fixtures');

// The times are late in the evening on purpose, so a reminder is not "due"
// (and no banner shows up) for almost the whole day. The assertions below do
// not depend on the banner either way.
const MEDICINE = 'Vitamin D';
const NOTE = 'after lunch';
const TIME = '23:45';
const NEW_TIME = '23:50';

async function fillReminder(page, { medicine = MEDICINE, note = NOTE, time = TIME } = {}) {
  await page.locator('#medicine').fill(medicine);
  await page.locator('#instructions').fill(note);
  await page.locator('#time').fill(time);
}

test.describe('medicine reminders on the dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pages/dashboard.html');
    await expect(page.locator('#reminder-list')).toContainText('No reminders yet.');
  });

  test('empty form shows validation errors and saves nothing', async ({ page }) => {
    await page.locator('#reminder-submit').click();
    const errors = page.locator('#reminder-errors');
    await expect(errors).toBeVisible();
    await expect(errors).toContainText('Enter a medicine name or label.');
    await expect(errors).toContainText('Pick a time.');
    await expect(page.locator('#reminder-list')).toContainText('No reminders yet.');
  });

  test('creating a reminder lists it, counts it and keeps it after a reload', async ({ page }) => {
    await fillReminder(page);
    await page.locator('#reminder-submit').click();

    const item = page.locator('#reminder-list .reminder-item');
    await expect(item).toHaveCount(1);
    await expect(item).toContainText(MEDICINE);
    await expect(item).toContainText(`Daily at ${TIME}`);
    await expect(item).toContainText(NOTE);
    await expect(item.locator('.pill')).toHaveText('Active');
    await expect(page.locator('#kpi-reminders')).toHaveText('1');
    await expect(page.locator('#timeline')).toContainText('Medication reminder created');
    // the form is cleared for the next one
    await expect(page.locator('#medicine')).toHaveValue('');

    await page.reload();
    const again = page.locator('#reminder-list .reminder-item');
    await expect(again).toHaveCount(1);
    await expect(again).toContainText(MEDICINE);
    await expect(again).toContainText(`Daily at ${TIME}`);
    await expect(page.locator('#kpi-reminders')).toHaveText('1');
  });

  test('the same medicine at the same time is refused', async ({ page }) => {
    await fillReminder(page);
    await page.locator('#reminder-submit').click();
    await expect(page.locator('#reminder-list .reminder-item')).toHaveCount(1);

    await fillReminder(page);
    await page.locator('#reminder-submit').click();
    await expect(page.locator('#reminder-errors')).toContainText(`You already have a reminder for ${MEDICINE} at ${TIME}.`);
    await expect(page.locator('#reminder-list .reminder-item')).toHaveCount(1);
  });

  test('editing a reminder changes its time', async ({ page }) => {
    await fillReminder(page);
    await page.locator('#reminder-submit').click();
    const item = page.locator('#reminder-list .reminder-item');
    await expect(item).toHaveCount(1);

    await item.locator('button[data-action="edit"]').click();
    await expect(page.locator('#reminder-submit')).toHaveText('Update Reminder');
    await expect(page.locator('#medicine')).toHaveValue(MEDICINE);
    await expect(page.locator('#time')).toHaveValue(TIME);

    await page.locator('#time').fill(NEW_TIME);
    await page.locator('#reminder-submit').click();

    await expect(item).toHaveCount(1);
    await expect(item).toContainText(`Daily at ${NEW_TIME}`);
    await expect(item).not.toContainText(`Daily at ${TIME}`);
    await expect(page.locator('#reminder-submit')).toHaveText('Save Reminder');
    await expect(page.locator('#timeline')).toContainText('Medication reminder updated');

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('relief_reminders_v1')));
    expect(saved).toHaveLength(1);
    expect(saved[0].time).toBe(NEW_TIME);
  });

  test('a reminder can be paused and resumed', async ({ page }) => {
    await fillReminder(page);
    await page.locator('#reminder-submit').click();
    const item = page.locator('#reminder-list .reminder-item');
    await expect(item).toHaveCount(1);

    await item.locator('button[data-action="pause"]').click();
    await expect(item.locator('.pill')).toHaveText('Paused');
    await expect(page.locator('#kpi-reminders')).toHaveText('0');

    await item.locator('button[data-action="resume"]').click();
    await expect(item.locator('.pill')).toHaveText('Active');
    await expect(page.locator('#kpi-reminders')).toHaveText('1');
  });
});
