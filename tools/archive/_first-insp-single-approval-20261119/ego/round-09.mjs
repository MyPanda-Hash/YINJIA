const task = await taskSpace('first-insp-approval-20261119');
const page = task.page('p1');
const clickRail = async (label) => {
  await page.evaluate((l) => {
    const el = [...document.querySelectorAll('.as-side-btn')]
      .find((x) => (x.textContent || '').replace(/\s+/g, ' ').trim() === l && !x.classList.contains('disabled'));
    if (!el) throw new Error('侧栏没有可点按钮：' + l);
    el.click();
  }, label);
  await page.waitForTimeout(3000);
};
const state = () => page.evaluate(() => {
  const txt = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const foot = [...document.querySelectorAll('.fi-foot th, .fi-foot td')].map(txt);
  return {
    docNo: (document.body.innerText.match(/SJ[-\w]+/) || [''])[0],
    toasts: [...document.querySelectorAll('.el-message')].map(txt),
    dialogs: [...document.querySelectorAll('.el-dialog__title')].map(txt),
    foot,
    bodyStatus: (document.body.innerText.match(/单据状态[：:\s]*([^\s]{2,6})/) || ['', ''])[1],
    railBtns: [...document.querySelectorAll('.as-side-btn')].map((b) => txt(b) + (b.classList.contains('disabled') ? '(禁用)' : '')),
  };
});

await clickRail('保存');
console.log('after 保存:', JSON.stringify(await state(), null, 2));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/first-insp-1119/ego/round-09-saved.png', fullPage: true });
