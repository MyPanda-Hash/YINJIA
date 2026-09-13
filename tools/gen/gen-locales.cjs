// gen-locales.cjs — 批量生成语言包词条(机翻+落库+写入静态包,已有词条自动跳过)
// 用法: 修改 KEYS 后 node gen-locales.cjs(后端需运行且机翻权限已开)
const fs = require('fs')
const path = require('path')

const LOCALES = ['ja', 'ko', 'es', 'fr', 'de', 'ru', 'vi', 'th']
const KEYS = [
  '高级筛选', '添加条件', '字段', '运算符', '值', '包含', '等于', '不等于', '大于', '小于',
  '大于等于', '小于等于', '为空', '不为空', '重置', '请选择', '是', '否',
  // 登录页(es/vi 曾因机翻缺失回退中文)
  '轻 MES', '让生产现场', '有序运转', '生产制造执行系统', '聚焦现场', '协同执行', '持续改善',
  '制造协同工作台', '企业账号', '登录工作台', '进入制造协同工作台', '请输入登录账号', '请输入登录密码',
  '登录工厂', '正在加载工厂', '请选择登录工厂', '记住账号', '安全连接', '进入系统',
  '正在连接服务', '服务连接正常', '服务连接异常', '登录失败，请稍后重试',
  '工厂信息加载失败，请检查服务后重试', '账号', '密码', '姓名',
  // 查询方案
  '查询方案', '保存方案', '方案维护', '选择方案', '保存查询方案', '请输入方案名称', '方案名称不能为空',
  '查询方案已保存', '查询方案已更新', '重命名方案', '调用', '更新', '重命名', '暂无保存的查询方案',
  '当前没有可保存的查询条件',
]

async function main() {
  for (const locale of LOCALES) {
    const body = JSON.stringify({ locale, keys: KEYS })
    const res = await fetch('http://localhost:8090/api/locale/dict', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    })
    const j = await res.json()
    const dict = j?.data?.dict || {}
    const file = path.join(__dirname, '..', 'frontend', 'src', 'i18n', 'locales', `${locale}.js`)
    let src = fs.readFileSync(file, 'utf8')
    const lines = []
    for (const k of KEYS) {
      const v = dict[k]
      if (!v) continue
      const escK = k.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      // 查重:语言包里已有该词条则跳过,避免机翻覆盖已有翻译
      if (src.includes(`'${escK}':`)) continue
      const escV = String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, ' ')
      lines.push(`    '${escK}': '${escV}',`)
    }
    if (lines.length) {
      const idx = src.lastIndexOf('  },')
      src = src.slice(0, idx) + lines.join('\n') + '\n' + src.slice(idx)
      fs.writeFileSync(file, src, 'utf8')
    }
    console.log(`${locale}: 接口 ${Object.keys(dict).length}/${KEYS.length},新写入 ${lines.length} 条`)
  }
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
