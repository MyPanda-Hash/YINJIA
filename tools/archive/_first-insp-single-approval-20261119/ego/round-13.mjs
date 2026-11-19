const task = await taskSpace('first-insp-approval-20261119');
const page = task.page('p1');
const click = async (label) => {
  await page.evaluate((l) => {
    const el = [...document.querySelectorAll('.as-side-btn')]
      .find((x) => (x.textContent || '').replace(/\s+/g, ' ').trim() === l && !x.classList.contains('disabled'));
    if (!el) throw new Error('没有可点按钮：' + l);
    el.click();
  }, label);
};
const snap = () => page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  return {
    docNo: (document.body.innerText.match(/SJ[-\w]+/) || [''])[0],
    msgs: [...document.querySelectorAll('.el-message')].map(t),
    boxes: [...document.querySelectorAll('.el-message-box__message, .el-dialog__title')].map(t),
    foot: [...document.querySelectorAll('.fi-foot th, .fi-foot td')].map(t),
    status: (document.body.innerText.match(/单据状态[：:\s]*([^\s]{2,8})/) || ['', ''])[1],
  };
});

// 关闭「未保存提示」弹窗(若有)
await page.evaluate(() => {
  const box = document.querySelector('.el-message-box__wrapper');
  if (box) {
    const btn = [...box.querySelectorAll('button')].find((b) => /取消|关闭|确定/.test(b.textContent || ''));
    if (btn) btn.click();
  }
});
await page.waitForTimeout(800);

await click('保存');
await page.waitForTimeout(3500);
console.log('after 保存:', JSON.stringify(await snap(), null, 2));

await click('提交审批');
await page.waitForTimeout(2500);
console.log('after 提交审批:', JSON.stringify(await snap(), null, 2));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/first-insp-1119/ego/round-13-submitted.png', fullPage: true });
