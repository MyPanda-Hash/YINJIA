const task = await taskSpace('first-insp-approval-20261119');
const page = task.page('p1');
const info = await page.evaluate(() => {
  const txt = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const cand = [...document.querySelectorAll('header *, .topbar *, .el-dropdown, .avatar, [title]')]
    .map((el) => ({ tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 50), title: el.getAttribute('title') || '', txt: txt(el).slice(0, 40) }))
    .filter((x) => x.txt || x.title).slice(0, 60);
  return { hash: location.hash, cand };
});
console.log(JSON.stringify(info, null, 2));
