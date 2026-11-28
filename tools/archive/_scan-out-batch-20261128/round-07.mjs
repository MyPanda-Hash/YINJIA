const task = await taskSpace(19);
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page));

const info = await page.evaluate(() => {
  const head = document.querySelector('.mo-batch-head');
  const row = document.querySelector('.mo-batch-row');
  return {
    headHTML: head ? head.outerHTML.slice(0, 800) : null,
    rowHTML: row ? row.outerHTML.slice(0, 500) : null,
    headBox: head ? head.getBoundingClientRect() : null,
    headChildren: head ? [...head.children].map((el) => ({
      tag: el.tagName,
      cls: el.className,
      w: Math.round(el.getBoundingClientRect().width),
      text: (el.textContent || '').trim().slice(0, 20),
    })) : null,
  };
});
console.log(JSON.stringify(info, null, 2));
