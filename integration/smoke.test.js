// These tests assume that the server is running locally on port 3000 and the
// test data is unchanged.
describe.skip('basic integration', () => {
  it('loads pages', async () => {
    await page.goto('http://localhost:3000');
    await expect(page.title()).resolves.toEqual('Latest bookmarks | Postmarks');
    await page.locator('a[href="/bookmark/1"]').click();
    await page.waitForNavigation();
    await expect(page.title()).resolves.toEqual('Postmarks - Getting Started | Postmarks');
    expect(await page.content()).toMatch('Some notes on setup and acknowledgements');
  });
});
