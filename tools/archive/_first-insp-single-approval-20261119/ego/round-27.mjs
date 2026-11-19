const task = await taskSpace('first-insp-approval-20261119');
const page = task.page('p1');
const info = await page.evaluate(() => {
  const lis = [...document.querySelectorAll('.fi-requirements li')];
  return lis.map((li, i) => ({
    i: i + 1,
    text: (li.innerText || '').trim(),
    color: getComputedStyle(li).color,
    html: li.innerHTML.slice(0, 120),
  }));
});
console.log(JSON.stringify(info, null, 2));
