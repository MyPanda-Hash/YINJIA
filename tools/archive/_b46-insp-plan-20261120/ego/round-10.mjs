const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
const info = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(d => d.offsetParent !== null);
  return {
    hash: location.hash,
    dialogs: dlg.map(d => ({
      title: (d.querySelector('.el-dialog__title') || {}).textContent,
      text: (d.innerText || '').replace(/\n{2,}/g, '\n').slice(0, 500),
      btns: [...d.querySelectorAll('button')].map(b => (b.textContent || '').trim()).filter(Boolean),
      inputs: [...d.querySelectorAll('input')].map(i => i.placeholder),
    })),
    bodyTail: (document.body.innerText || '').slice(-600),
  };
});
console.log(JSON.stringify(info, null, 2));
