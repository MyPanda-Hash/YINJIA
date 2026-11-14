/**
 * railStatusTabs.test.js —— 左栏「未完成 / 已完成 / 全部」状态页签的回归闸(2026-11-10)
 *
 * 【用户原话】「出货功能检验中在左侧的列表中增加对应的页签实现已审核的完成单据和未完成的分开显示,
 *   增加在当前列表处的部分,不要修改其他页面的这个组件我先确认查看」
 *   2026-11-11 追加:「修改一下顺序,把未完成放在最左侧作为打开页面的默认选项」。
 *
 * 【本测试守什么】
 *   ① 页签**只对 QC_PROC_INSP 开放**:PanelxList 的 RAIL_STATUS_TABS 只登记这一张单,
 *      后端 QueryService 的 STATUS_TAB_PANELS 也只认这一张单 —— 任何一边漏了闸,
 *      其他 20+ 个带左栏的面板都会莫名多出页签或被静默过滤成空列表;
 *   ② 顺序与默认项:**未完成在最左,且数组首项就是默认页签**(不是硬写 'todo'),
 *      否则用户口径「打开页面默认停在未完成」会悄悄退回「全部」;
 *   ③ 页签文案全部走 tt()(AGENTS 多语言红线),且 10 个语种都有词条
 *      —— 词条本来就存在,本测试只是钉住"别把 label 写成裸中文/别删词条";
 *   ④ 两处 DocSelectRail(纸面 approval-layout / 网格单据卡片)都接上了 @tab,
 *      并且都吃同一份 railBind(tabs/activeTab)—— 否则其中一种分支点了页签没反应。
 *
 * 写法照 generateLinesDialog.test.js:node:test + readFileSync 读源码断言(不引 vue 运行时)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const list = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
const rail = readFileSync(new URL('./DocSelectRail.vue', import.meta.url), 'utf8')

const LOCALES = ['en', 'ja', 'ko', 'zh-TW', 'es', 'de', 'fr', 'ru', 'vi', 'th']
const readLocale = (name) => readFileSync(new URL(`../../i18n/locales/${name}.js`, import.meta.url), 'utf8')

/** 后端 QueryService(跨目录:views → core → src → frontend → 仓库根 → backend/)。
 *  读不到就直接 FAIL 并打路径 —— 静默 skip 会让"后端闸门缺失"永远发现不了。 */
const BACKEND_REL = '../../../../backend/src/main/java/com/yinjia/mes/service/QueryService.java'
let backendSrc = null
let backendReadError = ''
try {
  backendSrc = readFileSync(new URL(BACKEND_REL, import.meta.url), 'utf8')
} catch (e) {
  backendReadError = String(e && e.message ? e.message : e)
}

/** 抽出 PanelxList 里 `const RAIL_STATUS_TABS = { ... }` 的整段源码(到列首的 `}` 为止)。
 *  注释里也会提到面板编码,所以**先切出对象体**再抽键,不能用全文正则。 */
function railStatusTabsBlock(src) {
  const anchor = src.indexOf('const RAIL_STATUS_TABS')
  assert.notEqual(anchor, -1, 'PanelxList 里找不到 RAIL_STATUS_TABS 定义')
  const end = src.indexOf('\n}', anchor)
  assert.notEqual(end, -1, 'RAIL_STATUS_TABS 对象没有正常闭合')
  return src.slice(anchor, end)
}

/** 从对象体抽「面板编码:」键(行首两空格 + 大写编码 + 冒号),注释行以 * 开头,不会误命中 */
function railStatusPanelCodes(block) {
  return [...block.matchAll(/^ {2}([A-Z][A-Z0-9_]*):\s*\[/gm)].map((m) => m[1])
}

test('PanelxList:RAIL_STATUS_TABS 只登记三张工序检验单(其他面板左栏必须零变化)', () => {
  const codes = railStatusPanelCodes(railStatusTabsBlock(list))
  // 2026-11-12 用户口径「这个页签也为当前的出货检验表观增加」⇒ 功能单 + 表观单,别的面板一律不开
  assert.deepEqual(codes, ['QC_PROC_INSP', 'QC_ASM_INSP', 'QC_FIRST_INSP'],
    '状态页签只对三张工序检验单开启(出货检验功能/出货检验表观/首件检验单)—— 其余面板不动')
  // 三个键齐全且顺序固定:未完成 / 已完成 / 全部
  // (2026-11-11 用户口径「把未完成放在最左侧」⇒ 顺序即渲染顺序,首项 = 默认页签,别随手挪)
  const block = railStatusTabsBlock(list)
  const keys = [...block.matchAll(/key:\s*'([a-z]+)'/g)].map((m) => m[1])
  // 两个面板各一份、三键顺序相同(2026-11-12 表观单接入后共 6 个 key)
  assert.deepEqual(keys, ['todo', 'done', 'all', 'todo', 'done', 'all', 'todo', 'done', 'all'],
    '三个面板的页签顺序都必须是 未完成(todo) → 已完成(done) → 全部(all);后端 _statusTab 同名')
  for (const label of ['全部', '已完成', '未完成']) {
    assert.ok(block.includes(`label: '${label}'`), `页签 label 缺「${label}」`)
  }
})

test('PanelxList:页签接线(railBind + load 控制键 + 切面板复位 + 两处 @tab)', () => {
  assert.match(list, /const railStatusTabs = computed\(\(\) => RAIL_STATUS_TABS\[panelCode\.value\] \|\| \[\]\)/,
    '页签集合要按当前面板派生(未登记的面板恒为 [])')
  assert.match(list, /const railStatusTab = ref\('all'\)/, '当前页签键必须是响应式真源')
  assert.match(list, /tabs: railStatusTabs\.value,/, 'railBind 要统一下发 tabs(两处渲染共用一份)')
  assert.match(list, /activeTab: railStatusTab\.value,/, 'railBind 要统一下发 activeTab(高亮跟随)')
  // 默认页签 = 登记表**首项**(未完成),不能硬写 'todo' —— 顺序即默认项(2026-11-11 用户口径)
  assert.match(list,
    /const railStatusTabDefault = computed\(\(\) => \(railStatusTabs\.value\.length \? railStatusTabs\.value\[0\]\.key : 'all'\)\)/,
    '默认页签必须取登记表首项(未完成在最左 ⇒ 默认未完成);未登记页签的面板退 all')
  assert.match(list, /railStatusTab\.value = railStatusTabDefault\.value/,
    '切面板时要把页签复位成默认项(不是硬写 all,否则打开面板仍停在全部)')
  // load():只在非 all 时把控制键塞进 condition(派生、不写进共用 condition)
  assert.match(list,
    /if \(railStatusTabs\.value\.length && railStatusTab\.value !== 'all'\) params\.condition\._statusTab = railStatusTab\.value/,
    'load() 要把当前页签派生成 condition._statusTab(键以 _ 开头,后端只对登记面板认)')
  // 深链 ?focus=:要定位的单据可能被默认页签(未完成)过滤掉 ⇒ 回退「全部」再取一次,
  // 否则「查看单据」打开一张已审核的检验单只会停在第一张,用户以为单子丢了(2026-11-11)
  assert.match(list,
    /if \(fi < 0 && railStatusTabs\.value\.length && railStatusTab\.value !== 'all'\) \{\s*railStatusTab\.value = 'all'\s*query\.pageNo = 1\s*await load\(true\)/,
    '?focus= 定位不到的单据要回退「全部」重取(deep link 优先于页签)')
  // 页签点击要走未保存草稿守卫,并归 1 页 / 归 0 下标后重新取数
  assert.match(list, /function onRailTab\(key\) \{/, '缺 onRailTab handler')
  assert.match(list, /guardPageAction\(async \(\) => \{ railStatusTab\.value = k; query\.pageNo = 1; await load\(\); curIdx\.value = 0 \}\)/,
    'onRailTab 必须走 guardPageAction,并 pageNo=1 / curIdx=0 / 重新 load()')
  // 两处 DocSelectRail(纸面 + 网格)都要绑定 @tab —— 统计出现次数,少一处就是某分支点页签没反应
  // ⚠ 2026-11-15 合并 origin/main 后:**第三处 DocSelectRail 是右栏「单据预览」**
  //    (远程 2026-11-13 用户口径「我要左边栏的展示效果在右边展示」⇒ 右栏直接复用同一个组件)。
  //    那一处只渲染列表/翻页/搜索、**不挂页签**(previewRailBind 不下发 tabs),
  //    所以「绑 @tab 的处数」仍是 2,但组件出现次数 >= 2(当前 3)。
  const rails = [...list.matchAll(/<DocSelectRail\b/g)].length
  const tabBinds = [...list.matchAll(/@tab="onRailTab"/g)].length
  assert.ok(rails >= 2, 'DocSelectRail 至少两处渲染(approval-layout 纸面分支 + 网格单据卡片分支;右栏单据预览复用第三处)')
  assert.equal(tabBinds, 2, '只有两处「列表左栏」绑 @tab="onRailTab"(右栏单据预览不挂页签)')
  assert.match(list, /const previewRailBind = computed/, '右栏单据预览必须走独立 previewRailBind(不在它里面下发 tabs)')
  const previewBlock = list.slice(list.indexOf('const previewRailBind = computed'), list.indexOf('function onRailSelect'))
  assert.ok(!/tabs:/.test(previewBlock), 'previewRailBind 不得下发 tabs(否则页签点了没反应)')
})

test('DocSelectRail:页签条存在、三个 label 都走 tt()、模板区没有裸中文页签行', () => {
  // props:默认空数组 ⇒ 未传 tabs 的面板完全不渲染页签条(零变化)
  assert.match(rail, /tabs: \{ type: Array, default: \(\) => \[\] \}/, 'DocSelectRail 要新增 tabs prop(默认 [])')
  assert.match(rail, /activeTab: \{ type: String, default: 'all' \}/, 'DocSelectRail 要新增 activeTab prop')
  assert.match(rail, /defineEmits\(\[[^\]]*'tab'[^\]]*\]\)/, "DocSelectRail 要新增 emit 'tab'")
  assert.match(rail, /v-if="tabs\.length" class="dsr-tabs"/, '页签条要 v-if=tabs.length(未传就不渲染)')
  assert.match(rail, /\$emit\('tab', t\.key\)/, '点页签要把键上抛父组件')
  assert.match(rail, /tt\(t\.label\)/, 'label 必须走 tt():中文原文下发、渲染时出译名')
  // 模板区(根 </template> 之前,去掉注释)不允许出现不走 tt() 的中文行
  const tplEnd = rail.indexOf('\n</template>')
  assert.notEqual(tplEnd, -1, 'DocSelectRail 模板没有正常闭合')
  const tpl = rail.slice(0, tplEnd).replace(/<!--[\s\S]*?-->/g, '')
  const bare = tpl
    .split('\n')
    .filter((line) => /[\u4e00-\u9fa5]/.test(line))
    .filter((line) => !line.includes('tt('))
  assert.deepEqual(bare, [], 'DocSelectRail 模板里出现未走 tt() 的中文:\n' + bare.join('\n'))
  // 样式:紧凑(11px)+ 主色激活底边,与侧栏整体风格一致
  assert.match(rail, /\.dsr-tab \{[^}]*font-size: 11px/, '.dsr-tab 字号要紧凑(11px)')
  assert.match(rail, /\.dsr-tab\.active \{[^}]*border-bottom-color: var\(--t-primary/, '激活页签用 2px 主色底边')
})

test('10 个语种都有「全部 / 已完成 / 未完成」词条(不新增词条,只钉住已有译名)', () => {
  const missing = []
  for (const name of LOCALES) {
    const src = readLocale(name)
    for (const key of ['全部', '已完成', '未完成']) {
      if (!src.includes(`'${key}'`)) missing.push(`${name}.js: ${key}`)
    }
  }
  assert.deepEqual(missing, [], '左栏页签词条缺失(AGENTS 多语言红线):\n' + missing.join('\n'))
})

test('后端 QueryService.STATUS_TAB_PANELS 只认 QC_PROC_INSP', () => {
  if (!backendSrc) {
    assert.fail(`读不到后端 QueryService.java(路径 ${BACKEND_REL}):${backendReadError}`)
  }
  // 取 STATUS_TAB_PANELS 的**定义**(不是 javadoc 里那处 {@link},注释行也会提到面板编码),
  // 到该语句的分号为止,再抽里面的面板编码字面量
  const anchor = backendSrc.indexOf('STATUS_TAB_PANELS =')
  if (anchor === -1) assert.fail('QueryService.java 里找不到 STATUS_TAB_PANELS 定义 —— 后端状态过滤闸门缺失')
  const stmtEnd = backendSrc.indexOf(';', anchor)
  const decl = backendSrc.slice(anchor, stmtEnd === -1 ? anchor + 800 : stmtEnd)
  const codes = [...new Set([...decl.matchAll(/["']([A-Z][A-Z0-9_]+)["']/g)].map((m) => m[1]))]
  assert.deepEqual([...codes].sort(), ['QC_ASM_INSP', 'QC_FIRST_INSP', 'QC_PROC_INSP'],
    'STATUS_TAB_PANELS 只含三张工序检验单(其他面板收到 _statusTab 必须忽略,防串味成空列表)')
  // 键名对齐:前端 condition._statusTab ⇔ 后端 STATUS_TAB_KEY
  assert.match(backendSrc, /STATUS_TAB_KEY\s*=\s*"_statusTab"/, '后端控制键必须叫 _statusTab(与前端一致)')
})
