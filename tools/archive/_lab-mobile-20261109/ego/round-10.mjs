const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')

// ① 新增记录
await page.click('css:.labm-card:nth-of-type(1) .labm-sec button')
await page.waitForTimeout(800)

// ② 设备名称(标准库字段 = el-select,可手输):点开 → 输入 → 回车
await page.click('xpath=(//div[contains(@class,"labm-field")][.//label[contains(.,"设备名称")]]//div[contains(@class,"el-select")])[1]')
await page.waitForTimeout(500)
await page.keyboard.type('手机端联调设备C')
await page.waitForTimeout(400)
await page.keyboard.press('Enter')
await page.waitForTimeout(400)

// ③ 表头备注 / 明细三格
await page.fill('xpath=(//div[contains(@class,"labm-field")][.//label[contains(.,"备注")]]//input)[1]', '手机端拍照联调-可删')
await page.fill('xpath=//div[contains(@class,"labm-field")][.//label[contains(.,"测试项目")]]//input', '手机端拍照联调项目C')
await page.fill('xpath=//div[contains(@class,"labm-field")][.//label[contains(.,"使用人")]]//input', '张三')

// ④ 选照片(模拟手机拍照:accept=image/* + capture=environment 的 file input)
await page.setInputFiles('css:input[type=file]', 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/test-photo.png')
await page.waitForTimeout(1200)

const staged = await page.evaluate(() => ({
  pending: [...document.querySelectorAll('.labm-photo.is-pending')].length,
  waitLabel: [...document.querySelectorAll('.labm-photo-wait')].map((e) => e.textContent.trim()),
  secText: [...document.querySelectorAll('.labm-sec')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  doc: document.querySelector('.labm-doc')?.textContent?.trim() || '',
}))
console.log('staged=' + JSON.stringify(staged, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-10-staged.png' })

// ⑤ 保存草稿 → 拿到单号后自动上传照片
await page.click('loc=role:button[name="保存草稿"]')
await page.waitForTimeout(6000)

const saved = await page.evaluate(() => ({
  doc: document.querySelector('.labm-doc')?.textContent?.trim() || '',
  photos: [...document.querySelectorAll('.labm-photo')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  thumbs: [...document.querySelectorAll('.labm-photo img')].length,
  err: document.querySelector('.labm-err')?.textContent?.trim() || '',
  lines: [...document.querySelectorAll('.labm-line')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  toast: [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  values: [...document.querySelectorAll('.labm-field')].map((f) => {
    const label = f.querySelector('label')?.textContent?.trim() || ''
    const sel = f.querySelector('.el-select')
    const selText = sel ? (sel.textContent || '').replace(/\s+/g, ' ').trim() : ''
    const input = f.querySelector('input')
    return label + '=' + (sel ? '[sel]' + selText : input ? input.value : '')
  }),
}))
console.log('saved=' + JSON.stringify(saved, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-11-saved.png' })
