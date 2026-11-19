const task = await taskSpace('sample-insp-1119');
const page = task.page('p1');
await page.goto('http://127.0.0.1:8090/#/login', { timeout: 30000 });
await page.waitForTimeout(2000);
// choose factory YJ_TEST
await page.evaluate(() => {
  const sels = [...document.querySelectorAll('.el-select')];
  sels[1].click();
});
await page.waitForTimeout(600);
await page.evaluate(() => {
  const opts = [...document.querySelectorAll('.el-select-dropdown__item')];
  const target = opts.find((x) => (x.textContent || '').includes('测试库'));
  if (target) target.click();
});
await page.waitForTimeout(700);
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const ins = [...document.querySelectorAll('input')];
  setVal(ins.find((i) => (i.placeholder || '').includes('登录账号')), 'admin');
  setVal(ins.find((i) => (i.placeholder || '').includes('登录密码')), '123456');
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'));
  if (btn) btn.click();
});
await page.waitForTimeout(5000);
await page.goto('http://127.0.0.1:8090/#/panelx/list/INSP_COMMISSION', { timeout: 30000 });
await page.waitForTimeout(4500);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(500);
} catch (e) {}
const info = await page.evaluate(() => {
  const body = (document.body.innerText || '').replace(/\s+/g, ' ');
  const noInput = document.querySelector('.ic-meta-no-input input');
  const cs = noInput ? getComputedStyle(noInput.closest('.el-input__wrapper') || noInput) : null;
  const rowCount = document.querySelectorAll('.el-table__body-wrapper tbody tr').length;
  const total = document.querySelector('.ic-items-total-val')?.textContent?.trim();
  return {
    hash: location.hash, rowCount,
    factory: body.includes('测试库') || body.includes('YJ_TEST'),
    hasNoInput: !!noInput, noValue: noInput?.value,
    wrapperBorderBottom: cs ? cs.borderBottom : null,
    wrapperBoxShadow: cs ? cs.boxShadow : null,
    total, sampleQty: [...document.querySelectorAll('.ic-grid input')].map((i) => i.value).filter(Boolean).slice(0, 3),
    body: body.slice(0, 300),
  };
});
console.log(JSON.stringify(info, null, 2));
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-sample-insp-1119/round-06-commission-draft.png' });
console.log({ screenshot: shot });
