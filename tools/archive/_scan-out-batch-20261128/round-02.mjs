const task = await taskSpace(19);
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page));
console.log('page', page.label);

const info = await page.evaluate(() => {
  const out = { keys: Object.keys(localStorage) };
  for (const k of Object.keys(localStorage)) {
    const v = localStorage.getItem(k) || '';
    out[k] = v.length > 300 ? v.slice(0, 120) + '…(' + v.length + ')' : v;
  }
  return out;
});
console.log(JSON.stringify(info, null, 2));
