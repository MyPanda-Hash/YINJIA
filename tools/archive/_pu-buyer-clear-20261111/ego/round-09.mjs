// round-09: 检查两个下拉的 DOM(是否有 clear 图标)+ 悬停截图 + 尝试点清空
const task = await taskSpace(3);
const page = task.page('p1');

const dom = await page.evaluate(() => {
  const out = [];
  for (const sel of document.querySelectorAll('.pup-buyer-sel, .pup-buyer-tel')) {
    out.push({
      cls: String(sel.className),
      html: sel.outerHTML.slice(0, 700),
      clearBtn: !!sel.querySelector('.el-select__clear'),
      iconCls: sel.querySelector('.el-select__suffix')?.innerHTML?.slice(0, 200) || '',
    });
  }
  return out;
});
console.log(JSON.stringify(dom, null, 2));

// 悬停第一个下拉(需方联系人)
const box = await page.evaluate(() => {
  const r = document.querySelector('.pup-buyer-sel').getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: r.width, h: r.height };
});
console.log('box', box);
await page.mouse.move(box.x, box.y, { label: '悬停需方联系人' });
await page.waitForTimeout(700);
const afterHover = await page.evaluate(() => {
  const sel = document.querySelector('.pup-buyer-sel');
  const clear = sel.querySelector('.el-select__clear');
  return {
    wrapperCls: String(sel.querySelector('.el-select__wrapper')?.className || ''),
    clearExists: !!clear,
    clearVisible: clear ? getComputedStyle(clear).display !== 'none' && clear.getBoundingClientRect().width > 0 : false,
    clearRect: clear ? clear.getBoundingClientRect().toJSON() : null,
  };
});
console.log('afterHover', JSON.stringify(afterHover, null, 2));
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pu-buyer-clear-20261111/round-09-hover.png', clip: { x: 0, y: 120, width: 900, height: 90 } });
