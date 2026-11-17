// round-13: 5173 复验(改完)——重开单据 → 打印弹窗 → 点「清空」→ 打印 → 纸面需方框应为空
const task = await taskSpace(3);
const page = task.page('p1');
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 });
await page.waitForTimeout(4500);

await page.dblclick('tbody tr:has-text("PO-2026-11-0012")', { label: '打开采购订单' });
await page.waitForTimeout(4000);

// 点工具栏「打印」(主动作 = 打印采购订单/有金额)
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.tb-main')].find((e) => (e.textContent || '').trim() === '打印');
  if (el) el.click();
});
await page.waitForTimeout(4500);

const dlg = await page.evaluate(() => {
  const pup = document.querySelector('.pup');
  if (!pup) return { open: false };
  const clearBtn = [...pup.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '清空');
  return {
    open: true,
    tip: (document.querySelector('.pup-buyer .pup-tip')?.innerText || '').replace(/\s+/g, ' ').trim(),
    buttons: [...pup.querySelectorAll('.pup-buyer button')].map((b) => (b.textContent || '').trim()),
    clearBtn: clearBtn ? { text: clearBtn.innerText.trim(), disabled: clearBtn.disabled } : null,
    name: (document.querySelector('.pup-buyer-sel')?.innerText || '').replace(/\s+/g, ' ').trim(),
    tel: (document.querySelector('.pup-buyer-tel')?.innerText || '').replace(/\s+/g, ' ').trim(),
  };
});
console.log('dialog:', JSON.stringify(dlg, null, 2));

// 点「清空」
await page.evaluate(() => {
  const pup = document.querySelector('.pup');
  const clearBtn = [...pup.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '清空');
  if (clearBtn) clearBtn.click();
});
await page.waitForTimeout(600);
const afterClear = await page.evaluate(() => ({
  name: (document.querySelector('.pup-buyer-sel')?.innerText || '').replace(/\s+/g, ' ').trim(),
  tel: (document.querySelector('.pup-buyer-tel')?.innerText || '').replace(/\s+/g, ' ').trim(),
  clearDisabled: (() => {
    const b = [...document.querySelectorAll('.pup-buyer button')].find((x) => (x.textContent || '').trim() === '清空');
    return b ? b.disabled : null;
  })(),
}));
console.log('after clear:', JSON.stringify(afterClear));

try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pu-buyer-clear-20261111/round-13-clearbtn.png', clip: { x: 0, y: 120, width: 1180, height: 200 } });
