const task = await taskSpace('first-insp-approval-20261119');
const page = task.page('p1');
const seen = [];
const snap = () => page.evaluate(() => {
  const txt = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  return {
    msgs: [...document.querySelectorAll('.el-message')].map(txt),
    boxes: [...document.querySelectorAll('.el-message-box__message, .el-dialog__title, .el-form-item__error')].map(txt),
    dirtyFlag: !!document.querySelector('.as-side-btn.primary'),
  };
});
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.as-side-btn')]
    .find((x) => (x.textContent || '').replace(/\s+/g, ' ').trim() === '保存' && !x.classList.contains('disabled'));
  el.click();
});
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(250);
  const s = await snap();
  if (s.msgs.length || s.boxes.length) seen.push({ t: i * 250, ...s });
}
console.log(JSON.stringify(seen, null, 2));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/first-insp-1119/ego/round-10-save-msgs.png', fullPage: true });
