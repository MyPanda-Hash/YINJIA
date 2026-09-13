/* 检查 9 个语言包里缺哪些词条(临时脚本) */
const fs = require('fs')
const dir = 'C:/INCER/YINJIA-MES/frontend/src/i18n/locales/'
const words = ['使用权限查看', '面板名', '按钮/动作', '开始日期', '结束日期', '类型', '来源IP', '操作时间', '登录', '操作', '账号', '姓名', '面板', '单据号', '动作', '查询', '重置']
for (const loc of ['en', 'ja', 'ko', 'de', 'es', 'fr', 'ru', 'th', 'vi']) {
  const s = fs.readFileSync(dir + loc + '.js', 'utf8')
  const miss = words.filter((w) => !s.includes("'" + w + "'") && !s.includes('"' + w + '"'))
  console.log(loc + ': missing=' + JSON.stringify(miss))
}
