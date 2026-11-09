const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')

// 先把 设备名称 那个 el-select 打开,看焦点落在哪、下拉里有什么
await page.click('xpath=(//div[contains(@class,"labm-field")][.//label[contains(.,"设备名称")]]//div[contains(@class,"el-select")])[1]')
await page.waitForTimeout(800)
const probe = await page.evaluate(() => {
  const ae = document.activeElement
  const field = document.querySelectorAll('.labm-field')
  const equipField = [...field].find((f) => (f.querySelector('label')?.textContent || '').includes('设备名称'))
  return {
    active: ae ? { tag: ae.tagName, cls: ae.className, ph: ae.placeholder || '' } : null,
    innerInputs: equipField ? [...equipField.querySelectorAll('input')].map((i) => ({ cls: i.className, ph: i.placeholder || '', val: i.value })) : [],
    dropdowns: [...document.querySelectorAll('.el-select-dropdown')].filter((e) => e.offsetParent !== null)
      .map((d) => [...d.querySelectorAll('li')].map((li) => (li.textContent || '').trim())),
  }
})
console.log(JSON.stringify(probe, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-12-dropdown.png' })
