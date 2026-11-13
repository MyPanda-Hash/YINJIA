// round-01:新补的两张单据在界面上的样子(字段显示/隐藏 + 菜单挂点)
// 目标 = 8091(本次新代码 + 新前端静态产物),登录工厂 = YJ_TEST(测试账套)
const task = await taskSpace('return-docs-20261113');
const page = task.page('p1');

const login = async () => {
  await page.goto('http://127.0.0.1:8091/#/panelx/list/SALE_IN', { timeout: 30000 });
  await page.waitForTimeout(2500);
  const needLogin = await page.evaluate(() => !!document.querySelector('input[placeholder*="密码"]'));
  if (needLogin) {
    await page.evaluate(() => {
      const setVal = (el, v) => {
        const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const ins = [...document.querySelectorAll('input')];
      setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin');
      setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456');
    });
    // 登录工厂选测试库(YJ_TEST)
    await page.evaluate(() => {
      const sel = document.querySelector('.el-select');
      if (sel) sel.click();
    });
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      const opt = [...document.querySelectorAll('.el-select-dropdown__item')].find((el) => (el.textContent || '').includes('测试库'));
      if (opt) opt.click();
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'));
      if (btn) btn.click();
    });
    await page.waitForTimeout(4000);
  }
};

await login();
await page.goto('http://127.0.0.1:8091/#/panelx/list/SALE_IN', { timeout: 30000 });
await page.waitForTimeout(4000);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(600);
} catch (e) { console.log('restore skip: ' + e.message); }

const info = await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const tableHeads = [...document.querySelectorAll('.el-table__header th')].map(txt).filter(Boolean);
  const buttons = [...document.querySelectorAll('button')].map(txt).filter(Boolean).slice(0, 40);
  const rows = [...document.querySelectorAll('.el-table__body tr')].length;
  const inputs = [...document.querySelectorAll('.el-form-item__label')].map(txt).filter(Boolean);
  return { hash: location.hash, title: document.title, tableHeads, buttons, rows, formLabels: inputs.slice(0, 40) };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: 'C:/Users/Lenovo/ego/return-docs-20261113/sale-in.png' });
