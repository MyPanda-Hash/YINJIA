const task = await taskSpace("copydoc-20261123");
const page = task.page("p1");
const info = await page.evaluate(() => {
  const sheet = document.querySelector('.approval-sheet, .sheet-scroll');
  const txt = sheet ? sheet.innerText.replace(/\s+/g, ' ').slice(0, 700) : '(no sheet)';
  const inputs = [...document.querySelectorAll('.sheet-scroll input')].map((el) => el.value).filter(Boolean).slice(0, 25);
  return { txt, inputs };
});
console.log(JSON.stringify(info, null, 1));
