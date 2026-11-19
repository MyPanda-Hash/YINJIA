const task = await taskSpace('sample-insp-1119');
const page = task.page('p1');
console.log(await page.url());
console.log(JSON.stringify(await page.evaluate(() => ({
  hash: location.hash,
  selects: [...document.querySelectorAll('.el-select')].length,
  inputs: [...document.querySelectorAll('input')].map((i)=>({ph:i.placeholder,type:i.type})),
  text: (document.body.innerText||'').replace(/\s+/g,' ').slice(0,300),
})), null, 2));
