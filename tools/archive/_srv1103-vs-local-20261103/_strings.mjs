// 抽取 JS 包里出现的中文字面量(用于跨构建比对语义差异)
// 用法: node _strings.mjs <assets目录> > out.txt
import fs from 'node:fs'
import path from 'node:path'

const dir = process.argv[2]
const set = new Set()
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.js')) continue
  const txt = fs.readFileSync(path.join(dir, f), 'utf8')
  // 抓连续中文片段(含常见标点/全角)
  const re = /[\u4e00-\u9fa5][\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef0-9A-Za-z._\-—（）()【】「」:：,，。、/]*/g
  let m
  while ((m = re.exec(txt))) {
    const s = m[0].trim()
    if (s.length >= 2) set.add(s)
  }
}
;[...set].sort().forEach((s) => console.log(s))
