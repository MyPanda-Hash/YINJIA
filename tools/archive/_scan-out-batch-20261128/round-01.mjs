const SPACE_ID = null;
const entry = SPACE_ID === null ? undefined : (await listTaskSpaces()).find((s) => s.id === SPACE_ID);
const task = !entry
  ? await taskSpace('scan-out-batch-20261128')
  : entry.ownership === 'user'
    ? await claimTaskSpace(SPACE_ID)
    : entry.ownership === 'agentDelegatedToUser'
      ? await takeOverTaskSpace(SPACE_ID)
      : await taskSpace(SPACE_ID);
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page));
console.log({ taskSpaceId: task.spaceId, page: page.label });

await page.goto('http://localhost:5173/#/panelx/list/MOBILE_OTHER_PICK', { timeout: 30000 });
await page.waitForTimeout(3500);

const state = await page.evaluate(() => ({
  hash: location.hash,
  hasLoginForm: !!document.querySelector('input[placeholder*="账号"]'),
  bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
}));
console.log(JSON.stringify(state, null, 2));

try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(400);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/scan-out-batch-20261128/round-01.png' });
