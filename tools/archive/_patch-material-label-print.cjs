/**
 * _patch-material-label-print.cjs — 材料码弹窗:把「刷新数据」推迟到打印结束之后(2026-10-29)
 *
 * 用户报障:「供应商打印会卡死浏览器」。
 * 原代码 `await printProductCards(...)` 之后**立刻** `await load()` —— 而 printProductCards 只是把
 * 打印层挂上并 requestAnimationFrame 里调 window.print(),随即返回;此时浏览器正弹着打印对话框、
 * 占着渲染进程,这边又发 /px/puLabel/dialog 请求 + 重绘整张弹窗 ⇒ 界面像卡死(实测日志里打印后
 * 紧跟着又一次 puLabel/dialog 请求)。
 *
 * 改法:printProductCards 传 { onDone },把 load() 放到打印层摘掉之后。
 * 幂等:已改过就跳过。
 */
const fs = require('fs')
const path = require('path')
const FILE = path.join(__dirname, '..', '..', 'frontend', 'src', 'core', 'views', 'MaterialLabelDialog.vue')
let t = fs.readFileSync(FILE, 'utf8')

const OLD = [
  '    await printProductCards(cardsOf(res))',
  '    const docs = res[',
].join('\n')

const NEW = [
  '    // ⚠ 打印层挂上后 window.print() 是**异步**返回的(打印对话框还开着)。',
  '    //   原来这里紧接着 load() 刷新弹窗 ⇒ 打印对话框期间又发请求又重绘,界面像卡死(2026-10-29)。',
  '    //   现在把刷新放到 onDone(打印层摘掉 / afterprint)之后。',
  '    let afterPrint = null',
  '    await printProductCards(cardsOf(res), { onDone: () => { if (afterPrint) afterPrint() } })',
  '    const docs = res[',
].join('\n')

if (t.includes('let afterPrint = null')) { console.log('已改过,跳过'); process.exit(0) }
if (!t.includes(OLD)) { console.error('没找到目标片段,请人工确认'); process.exit(2) }
t = t.replace(OLD, NEW)

// 把那次 load() 改成写进 afterPrint 回调
const OLD_LOAD = '    await load()          // 刷新"剩余可打"与"已打印记录"'
const NEW_LOAD = [
  '    // 刷新"剩余可打"与"已打印记录":打印对话框可能还开着 → 先挂起,onDone 里再执行',
  '    afterPrint = () => { load() }',
  '    if (!document.getElementById(\'yj-print-host\')) afterPrint()   // 打印层已摘(打印被浏览器拒/已结束)则立即刷新',
].join('\n')
if (t.includes(OLD_LOAD)) {
  t = t.replace(OLD_LOAD, NEW_LOAD)
} else {
  console.warn('⚠ 没找到原 load() 行,请人工确认')
}

fs.writeFileSync(FILE, t, 'utf8')
console.log('已改:printProductCards 带 onDone;load() 推迟到打印结束')
