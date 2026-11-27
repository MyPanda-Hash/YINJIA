const task = await taskSpace('gl-kingdee-unrecv-20261127');
const page = task.page('p1');
const info = await page.evaluate(() => {
  const tt = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim() : '');
  return {
    hash: location.hash,
    rows: [...document.querySelectorAll('tr')].map(tt).filter((x) => /YJ-2026/.test(x)).slice(0, 20),
    search: [...document.querySelectorAll('input')].filter((i) => i.offsetParent && i.value).map((i) => `${i.placeholder || '?'}=${i.value}`).slice(0, 8),
  };
});
console.log(JSON.stringify(info, null, 1).slice(0, 3000));
