// 临时检查:en.js biz 里这些中文键是否已有译名(任务产物,归档目录)
import fs from 'node:fs'
const src = fs.readFileSync(new URL('../../../frontend/src/i18n/locales/en.js', import.meta.url), 'utf8')
const keys = ['全选', '恢复默认', '列设置', '保存', '取消', '日期范围', '开始日期', '结束日期',
  '今日', '本周', '本月', '近 7 天', '近 30 天', '上月', '显示', '隐藏', '搜索列', '全不选',
  '近7天', '近3天', '近14天', '近30天', '条', '笔', '产品名称', '型号', '客户订单号']
for (const k of keys) {
  const idx = src.indexOf(`'${k}':`)
  if (idx < 0) { console.log(k, '-> MISSING'); continue }
  const after = src.slice(idx + k.length + 3, idx + k.length + 3 + 120)
  console.log(k, '->', after.split('\n')[0].trim())
}
