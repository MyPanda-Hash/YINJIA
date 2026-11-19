const task = await taskSpace('first-insp-approval-20261119');
const page = task.page('p1');
const info = await page.evaluate(() => ({
  ls: Object.fromEntries(Object.keys(localStorage).map((k) => [k, String(localStorage.getItem(k)).slice(0, 24)])),
  cookies: document.cookie.split('; ').map((c) => c.split('=')[0]),
}));
console.log(JSON.stringify(info, null, 2));
