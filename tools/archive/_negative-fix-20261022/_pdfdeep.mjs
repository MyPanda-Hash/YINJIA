/**
 * 深度解析 PDF:逐页提取文本绘制位置,判断内容在哪被切开
 * PDF 里的 y 原点是左下角,需转换成「离页顶的距离」来对照。
 */
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

const path = process.argv[2]
const raw = readFileSync(path).toString('latin1')

// 逐页(按 /Type /Page 对象 + 其 Contents)
const pageRe = /\/Type\s*\/Page[^s][\s\S]*?(?=\/Type\s*\/Page[^s]|trailer)/g
const pages = [...raw.matchAll(pageRe)]

const PT2PX = 96 / 72
console.log('=== 每页内容纵向分布(换算成 CSS px,@96dpi)===\n')

pages.forEach((pm, pi) => {
  const p = pm[0]
  const media = p.match(/\/MediaBox\s*\[\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)/)
  const pageH = media ? Number(media[4]) : 841.89
  const pageW = media ? Number(media[3]) : 595.28

  // 找 Contents 引用
  const cref = p.match(/\/Contents\s+(\d+)\s+0\s+R/)
  let contentObj = null
  if (cref) {
    const objRe = new RegExp(`(?:^|[^0-9])${cref[1]}\\s+0\\s+obj([\\s\\S]*?)endobj`)
    const om = raw.match(objRe)
    if (om) {
      const sm = om[1].match(/stream\r?\n([\s\S]*?)endstream/)
      if (sm) {
        try { contentObj = inflateSync(Buffer.from(sm[1], 'latin1')).toString('latin1') }
        catch { contentObj = sm[1] }
      }
    }
  }
  if (!contentObj) {
    // 兜底:扫所有流
    const all = [...raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)]
    for (const s of all) {
      try {
        const t = inflateSync(Buffer.from(s[1], 'latin1')).toString('latin1')
        if (/\bTj\b|\bTJ\b|re\s+f/.test(t)) { contentObj = t; break }
      } catch { /* skip */ }
    }
  }

  const yPts = []
  if (contentObj) {
    // 收集所有「画矩形 re」的 y(表格线)与文本 Tm/Td 的 y
    for (const m of contentObj.matchAll(/([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+re/g)) yPts.push(Number(m[2]) + Number(m[4]))
    for (const m of contentObj.matchAll(/([\d.\-]+)\s+([\d.\-]+)\s+Td/g)) yPts.push(Number(m[2]))
    for (const m of contentObj.matchAll(/([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+Tm/g)) yPts.push(Number(m[6]))
  }

  console.log(`--- 第 ${pi + 1} 页: ${(pageW / 72 * 25.4).toFixed(1)} x ${(pageH / 72 * 25.4).toFixed(1)} mm ---`)
  if (!yPts.length) { console.log('   (未提取到绘制坐标)'); return }
  const maxY = Math.max(...yPts), minY = Math.min(...yPts)
  console.log(`   绘制 y 范围(pt): ${minY.toFixed(1)} ~ ${maxY.toFixed(1)}  (页高 ${pageH.toFixed(1)}pt)`)
  console.log(`   换算离页顶(px): 顶 ${((pageH - maxY) * PT2PX).toFixed(0)} ~ 底 ${((pageH - minY) * PT2PX).toFixed(0)}`)
  console.log(`   本页占用高度(px): ${((maxY - minY) * PT2PX).toFixed(0)}`)
})

console.log('\n=== 判断 ===')
console.log('   若第 1 页占用接近满页(≈1060px)且第 2 页只有零星内容 ⇒ 仍是被切开')
console.log('   若第 1 页只用了很少高度 ⇒ 说明内容整体被推到了第 2 页(布局问题,不是分页)')
