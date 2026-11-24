// 解 deploy/部署台账.md 的合并冲突(2026-11-24)
//  规则: 两侧都保留; 我方的「金蝶同步器更新」原编号 #69 与 origin 的 #69(纸面缩放)/#70(字数上限) 撞号,
//        按 append-only 原则不改别人的行 ⇒ 我方改号 #71(注明实际发生时间 17:26), 行与小节都排在 #70 之后。
import fs from 'node:fs'

const P = 'deploy/部署台账.md'
const raw = fs.readFileSync(P, 'utf8')
const eol = raw.includes('\r\n') ? '\r\n' : '\n'
const lines = raw.split(eol)

const out = []
let i = 0
let resolved = 0
while (i < lines.length) {
  if (lines[i] === '<<<<<<< HEAD') {
    const eq = lines.indexOf('=======', i)
    const gt = lines.indexOf('>>>>>>> origin/main', i)
    if (eq < 0 || gt < 0) throw new Error('冲突标记不成对 @' + i)
    const ours = lines.slice(i + 1, eq)
    const theirs = lines.slice(eq + 1, gt)
    resolved += 1

    if (resolved === 1) {
      // ① 表格行: origin 的 #69/#70 原样在前, 我方那行改号 #71 追加在后
      const mine = ours.map((l) => {
        if (!l.startsWith('| 69 | 2026-11-24 17:26 |')) return l
        return l
          .replace('| 69 | 2026-11-24 17:26 | 手工 RDP 替换金蝶同步器<br>',
            '| 71 | 2026-11-24 17:26 | 手工 RDP 替换金蝶同步器<br>（实际发生 17:26，#69/#70 已由并行会话占用，编号顺延 71）')
      })
      out.push(...theirs, ...mine)
    } else {
      // ② 详细小节: origin 的 #69/#70 两节在前, 我方那节改标题后排到最后
      const mine = ours.map((l) => {
        if (l === '### 2026-11-24 17:26 · 手工 RDP 替换金蝶同步器（4 个脚本；jar/库均未动，0 条迁移）') {
          return [
            '### 2026-11-24 17:26 · 部署 71 —— 手工 RDP 替换金蝶同步器（4 个脚本；jar/库均未动，0 条迁移）',
            '',
            '> 编号说明：#69/#70 已由并行会话的「纸面缩放」「字数上限」两次部署占用；本事件实际发生在 17:26（介于两者之间），',
            '> 按 append-only 不改他人行，编号顺延为 **71**，排在 #70 之后。',
          ].join(eol)
        }
        return l
      })
      out.push(...theirs, '', ...mine)
    }
    i = gt + 1
    continue
  }
  out.push(lines[i])
  i += 1
}

if (resolved !== 2) throw new Error('预期解 2 处冲突, 实际 ' + resolved)
fs.writeFileSync(P, out.join(eol), 'utf8')
console.log('OK: 解冲突 ' + resolved + ' 处, 行数 ' + out.length)
