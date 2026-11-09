const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')

// 从标准库下拉里选一台设备(allow-create 手输也支持,这里走"选现成条目"这条更贴现场的路径)
await page.click('css:.el-select-dropdown li:nth-child(3)')
await page.waitForTimeout(800)
const picked = await page.evaluate(() => {
  const f = [...document.querySelectorAll('.labm-field')].find((x) => (x.querySelector('label')?.textContent || '').includes('设备名称'))
  return { sel: (f.querySelector('.el-select')?.textContent || '').replace(/\s+/g, ' ').trim() }
})
console.log('picked=' + JSON.stringify(picked))

// 保存草稿 → 后端发号 → 自动上传已选照片
await page.click('loc=role:button[name="保存草稿"]')
await page.waitForTimeout(7000)

const saved = await page.evaluate(() => ({
  doc: document.querySelector('.labm-doc')?.textContent?.trim() || '',
  err: document.querySelector('.labm-err')?.textContent?.trim() || '',
  photos: [...document.querySelectorAll('.labm-photo')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  thumbs: [...document.querySelectorAll('.labm-photo img')].length,
  secText: [...document.querySelectorAll('.labm-sec')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  lines: [...document.querySelectorAll('.labm-line')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  toast: [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
}))
console.log('saved=' + JSON.stringify(saved, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-13-saved.png' })
