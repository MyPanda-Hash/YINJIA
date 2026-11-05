// round-53: 鎵撳紑鏂扮増銆婃垚鍨嬬敓浜т换鍔″崟銆嬫墦鍗?HTML 鈥斺€?鏍稿銆屽崟鎹紪鍙枫€嶆槸鍚︿竴琛屾斁寰椾笅
const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
await page.goto('file:///D:/YINJIA-main/tools/archive/_print-sheet-cols-20261105/task-sheet.html', { timeout: 30000 })
await page.waitForTimeout(1500)
console.log(JSON.stringify(await page.evaluate(() => {
  const cells = [...document.querySelectorAll('tbody tr td:nth-child(2)')]
  return cells.map((td) => ({ text: td.textContent, h: Math.round(td.getBoundingClientRect().height), w: Math.round(td.getBoundingClientRect().width) }))
}), null, 2))
try {
  const shot = await page.screenshot({ path: 'C:/Users/Lenovo/ego/pick-main-material-20261104/task-sheet-cols.png' })
  console.log({ shot })
} catch (e) { console.log('shot fail: ' + e.message) }

