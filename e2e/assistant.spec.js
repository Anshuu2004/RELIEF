const { test, expect } = require('./fixtures');

// The Relief Assistant on the dashboard is an inline panel that is always on the
// page, there is no launcher button to open or close it. What can be closed or
// reset is the conversation, through "Clear chat".
test.describe('Relief Assistant on the dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pages/dashboard.html');
  });

  test('greets the user when the page opens', async ({ page }) => {
    const bubbles = page.locator('#chatbot-messages .chat-bubble');
    await expect(bubbles).toHaveCount(1);
    await expect(bubbles.first()).toHaveClass(/bot/);
    await expect(bubbles.first()).toContainText('Relief Assistant');
  });

  test('a quick action gets a reply with a link to the right page', async ({ page }) => {
    await page.locator('.chip[data-chat="Find nearby hospitals"]').click();

    const bubbles = page.locator('#chatbot-messages .chat-bubble');
    await expect(bubbles).toHaveCount(3);
    await expect(bubbles.nth(1)).toHaveClass(/user/);
    await expect(bubbles.nth(1)).toContainText('Find nearby hospitals');
    await expect(bubbles.nth(2)).toHaveClass(/bot/);
    await expect(bubbles.nth(2).locator('.chat-link')).toHaveAttribute('href', './hospitals.html');
  });

  test('a medicine question is not answered with medical advice', async ({ page }) => {
    await page.locator('#chatbot-input').fill('Which tablet should I take for fever');
    await page.locator('#chatbot-input').press('Enter');

    const reply = page.locator('#chatbot-messages .chat-bubble.bot').last();
    await expect(reply).toContainText('medical advice');
    await expect(page.locator('#chatbot-input')).toHaveValue('');
  });

  test('emergency wording gets an urgent alert pointing to emergency services', async ({ page }) => {
    await page.locator('#chatbot-input').fill('I have chest pain');
    await page.locator('#chatbot-input').press('Enter');

    const alert = page.locator('#chatbot-messages .chat-bubble.bot.urgent');
    await expect(alert).toHaveAttribute('role', 'alert');
    await expect(alert).toContainText('emergency');
    await expect(alert.locator('.chat-link').first()).toHaveAttribute('href', './ambulances.html#emergency-sos');
  });

  test('Clear chat resets the conversation to the greeting', async ({ page }) => {
    await page.locator('.chip[data-chat="First aid tips"]').click();
    await expect(page.locator('#chatbot-messages .chat-bubble')).toHaveCount(3);

    await page.locator('#chatbot-clear').click();
    const bubbles = page.locator('#chatbot-messages .chat-bubble');
    await expect(bubbles).toHaveCount(1);
    await expect(bubbles.first()).toContainText('Relief Assistant');
    await expect(page.locator('#chatbot-input')).toBeFocused();
  });
});
