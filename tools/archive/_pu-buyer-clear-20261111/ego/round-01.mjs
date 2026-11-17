// round-01: 打开 5173 → 登录 → 采购订单列表 → 打开一张单 → 截图(看清 需方联系人/联系方式 是否能清空)
const SPACE_ID = null;
const entry = SPACE_ID === null ? undefined : (await listTaskSpaces()).find((s) => s.id === SPACE_ID);
const task = !entry
  ? await taskSpace('pu-print-buyer-clear-20261111')
  : entry.ownership === 'user'
    ? await claimTaskSpace(SPACE_ID)
    : entry.ownership === 'agentDelegatedToUser'
      ? await takeOverTaskSpace(SPACE_ID)
      : await taskSpace(SPACE_ID);
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page));
console.log({ taskSpaceId: task.spaceId, page: page.label });

await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 });
await page.waitForTimeout(5000);

async function loginIfNeeded() {
  return page.evaluate(() => {
    const ins = [...document.querySelectorAll('input')];
    const acc = ins.find((i) => (i.placeholder || '').includes('账号'));
    if (!acc) return false;
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      s.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    setVal(acc, 'admin');
    const pwd = ins.find((i) => (i.placeholder || '').includes('密码'));
    if (pwd) setVal(pwd, '123456');
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'));
    if (btn) btn.click();
    return true;
  });
}
const didLogin = await loginIfNeeded();
if (didLogin) {
  await page.waitForTimeout(5000);
  await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 });
  await page.waitForTimeout(4000);
}

const state = await page.evaluate(() => ({
  hash: location.hash,
  login: !!document.querySelector('input[placeholder*="账号"]'),
  rows: [...document.querySelectorAll('tbody tr')].slice(0, 8).map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160)),
  buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 60),
}));
console.log(JSON.stringify(state, null, 2));

try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(400);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pu-buyer-clear-20261111/round-01-list.png' });
console.log('shot ok');
