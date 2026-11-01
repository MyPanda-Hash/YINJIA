/**
 * specDraftOnDispatch.test.js —— 「分发责任人后自动建规格书草稿」的钉子(2026-10-16 用户口径)
 *
 * 【用户原话】「现在规格书的第一页没有自动引用产品信息表的数据,现在写一个规则,当产品信息表分发
 *   对应单据责任人之后,自动创建一张对应产品信息表的规格书,数据自动对应填写,保存为草稿,
 *   可继续对应补充完整,是真实填写过来而不是引用显示,导致其他的成型工艺清单等单据出现引用数据错误等」
 *
 * 【为什么必须"真实写入"】下游(成型工艺清单/组装工艺清单/出货检验计划表)按 [产品编号] 找规格书取数
 *   (DevTaskService.specByProduct → 明细带出);规格书第一页空着,它们那条链就取不到东西。
 *   所以这里断言的是"值落到 rd_spec_doc_head"(走与「保存为草稿」同一条引擎路径),不是参照显示。
 *
 * 单测跑不了运行时,按仓库既有做法读源码钉住(同 specDriftNotice.test.js)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const buttons = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')
const panelx = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
const en = readFileSync(new URL('../../i18n/locales/en.js', import.meta.url), 'utf8')

test('规则挂点:分发责任人(dispatchDev)之后自动建规格书草稿,并把单号回给前端', () => {
  assert.match(buttons,
    /Map<String, Object> out = devTaskService\.dispatch\(productCode, productName, no, user, supervisor, picks\);[\s\S]{0,700}?String specDraftNo = createSpecDraftFromProduct\(no, productCode, user\);/,
    '自动建草稿必须紧跟分发动作(同一事务),不能等前端再点一次')
  assert.match(buttons, /r\.put\("specDraftNo", specDraftNo\)/, '单号要回给前端做提示/直达')
})

test('幂等:该产品已有规格书单(任何未作废的单)就不再建', () => {
  assert.match(buttons, /SELECT COUNT\(\*\) FROM rd_spec_doc_head h/, '要先查该产品有没有规格书单')
  assert.match(buttons, /ISNULL\(h\.asp_cancel,'N'\) <> 'Y' AND ISNULL\(s\.canceled,'N'\) <> 'Y'/, '双软删都要排(作废单不算占用)')
  assert.match(buttons, /AND h\.\[产品编号\] = \?/, '按产品编号认单')
  assert.match(buttons, /if \(exist != null && exist > 0\) return "";/, '已存在就回空串跳过')
})

test('真实写入:走「保存为草稿」同一条引擎路径(markSaved=false),不是参照显示', () => {
  assert.match(buttons, /saveDoc\(specDef, draft, new ArrayList<>\(\), null, user, false, true\)/)
  assert.match(buttons, /private String createSpecDraftFromProduct\(String prodInfoNo, String productCode, String user\)/)
})

test('字段映射逐条显式列举(不做全表同名自动搬运)', () => {
  for (const k of ['产品编号', '名称', '产品类别', '客户项目名称', '客户料号']) {
    assert.ok(buttons.includes(`putIfVal(draft, "${k}"`), `缺映射 ${k}`)
  }
  assert.match(buttons, /putIfVal\(draft, "产品主要性能", src\.get\("特殊性能描述"\)\)/,
    '产品主要性能 ← 主要性能描述(数据键/列名是 特殊性能描述,永不改)')
  assert.match(buttons, /putIfVal\(draft, "整体规格参数", specSizeText\(src\)\)/, '整体规格参数 ← 尺寸合成文本')
  assert.match(buttons, /private String specSizeText\(Map<String, Object> src\)[\s\S]{0,900}?b\.append\("炭棒尺寸："\)/,
    '尺寸文本要同时含整体尺寸与炭棒尺寸')
  // 不该搬的:那是各自单据自己的口径
  assert.ok(!/putIfVal\(draft, "备注"/.test(buttons), '备注不该搬到规格书')
  assert.ok(!/putIfVal\(draft, "责任人"/.test(buttons), '责任人口径不同(规格书侧走 rd_dev_task/rd_spec_assign),不该搬')
})

test('内部代建草稿走 systemDraft 通道:跳过四文件责任人门禁,但外部入口仍不许跳', () => {
  assert.match(buttons,
    /private Map<String, Object> saveDoc\(PanelRegistry\.PanelDef def, Map<String, Object> head,\s*\n\s*List<Map<String, Object>> items, String no, String user, boolean markSaved\) \{\s*\n\s*return saveDoc\(def, head, items, no, user, markSaved, false\);/,
    '外部调用入口必须固定 systemDraft=false(否则用户也能绕门禁)')
  // 2026-10-30：改用 isDevFilePanel（含同族模板 X烧结）—— 同族模板同样受文件责任人门禁约束
  assert.match(buttons, /if \(!systemDraft && DevTaskService\.isDevFilePanel\(def\.code\(\)\)\) ensureDevFileEditable\(def, no, head, user\);/,
    '只有内部代建才跳过"该文件责任人才能建单"的门禁')
})

test('前端:提示已生成的规格书草稿单号,并给一键打开', () => {
  assert.match(panelx, /const sp = String\(res\?\.specDraftNo \|\| ''\)/, '要读后端回的 specDraftNo')
  assert.match(panelx, /已自动生成规格书草稿 \{no\}（数据已按产品信息表填好，可继续补充）/, '成功提示要说清单号')
  assert.match(panelx, /router\.push\(\{ path: '\/panelx\/list\/RD_SPEC_DOC', query: \{ docNo: sp \} \}\)/,
    '要能一键跳到那张草稿(规格书面板支持 ?docNo= 深链)')
})

test('新增 UI 文案都有多语言词条(en 至少)', () => {
  for (const k of ["'已分发 {n} 个文件的责任人':", "'已自动生成规格书草稿 {no}（数据已按产品信息表填好，可继续补充）':",
    "'已自动生成规格书草稿 {no}，是否现在打开继续补充？':", "'规格书草稿':", "'稍后':"]) {
    assert.ok(en.includes(k), `en.js 缺词条：${k}`)
  }
})

// ── 2026-10-16 用户补充口径两则 ──
const panelConfig = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/PanelConfigService.java', import.meta.url), 'utf8')

test('主要性能描述 ↔ 产品主要性能 走参照同义词(两侧标签不同,同名映射带不过去)', () => {
  assert.match(panelConfig, /Map\.entry\("主要性能描述", List\.of\("产品主要性能"\)\)/,
    '规格书选产品编号时要把「主要性能描述」(列名 特殊性能描述)带进「产品主要性能」')
  // 依赖前提:两侧字段真的存在(标签口径) —— 防止有人改 yj_field.label 后这条静默失效
  assert.match(buttons, /putIfVal\(draft, "产品主要性能", src\.get\("特殊性能描述"\)\)/,
    '自动建草稿那条路也按同一对应关系带值')
})

test('新建规格书的「版本」自动生成 V+年月日(仅新建且为空时写)', () => {
  // 2026-10-29 用户口径(产品规格书新版设计图):版本那格写「V+年月日」
  // ⇒ 由固定 V1.0 改为 V<yyyy-MM-dd>(如 V2026-10-29)。
  assert.match(buttons, /NEW_DOC_VERSION_DATE_PANELS = java\.util\.Set\.of\("RD_SPEC_DOC"\)/,
    '默认值表要有规格书')
  assert.match(buttons, /private static String newDocVersion\(String panelCode\)[\s\S]{0,260}?"V" \+ LocalDate\.now\(\)\.format\([\s\S]{0,80}?"yyyy-MM-dd"/,
    '版本默认值必须是 V+年月日(不是固定 V1.0)')
  assert.match(buttons, /String vdef1 = newDocVersion\(def\.code\(\)\);[\s\S]{0,220}?cols\.put\("版本", vdef1\);/,
    '空白草稿分支要写(自动建规格书草稿走的正是这一支)')
  assert.match(buttons, /String vdef2 = newDocVersion\(def\.code\(\)\);[\s\S]{0,260}?def\.byLabel\("版本"\) != null[\s\S]{0,200}?head\.put\("版本", vdef2\);/,
    '带明细新建分支同口径')
  // 不能覆盖已有版本(变更单「建下一版」是整单复制,不该被抹回默认值)
  assert.ok(!/UPDATE\s+\w+\s+SET\s+\[?版本\]?\s*=/.test(buttons), '不该有"UPDATE 版本"这种回写')
  assert.match(buttons, /if \(vdef1 != null && !cols\.containsKey\("版本"\)/, '只在没有值时写')
})

// ── 产品信息表 → 规格书草稿的字段映射(2026-10-30 用户报障「应用场景没有导过来,看看还有没有没导过来的字段」) ──
// 口径:凡**规格书有该字段、产品信息表也有该列**的，都必须带过去;两边对不上的不在此列。
test('规格书草稿的字段映射：产品信息表与规格书共有的字段一个都不能漏', () => {
  // 产品信息表(rd_prod_info_head) → 规格书(yj_field label) 的共有字段，逐条钉死
  const EXPECT = [
    ['产品编号', '产品编号'],
    ['名称', '产品名称'],
    ['产品类别', '产品类别'],
    ['客户项目名称', '客户项目名称'],
    ['客户料号', '客户料号'],
    ['产品主要性能', '特殊性能描述'],
    // 下面两条是 2026-10-30 补的 —— 原先漏了，实测 应用场景=台面机、客户名称 都没带进草稿
    ['应用场景', '应用场景'],
    ['客户名称', '客户名称'],
  ]
  for (const [specLabel, srcCol] of EXPECT) {
    const re = new RegExp(`putIfVal\\(draft, "${specLabel}", src\\.get\\("${srcCol}"\\)\\)`)
    assert.match(buttons, re, `规格书「${specLabel}」必须从产品信息表「${srcCol}」带过来`)
  }
  // 整体规格参数是拼装的(整体尺寸 + 炭棒三格)，单独确认
  assert.match(buttons, /putIfVal\(draft, "整体规格参数", specSizeText\(src\)\)/)
  // 反例守卫:别把规格书没有的字段硬塞进去(写不存在的 label 会被静默丢弃,反而掩盖问题)
  for (const absent of ['项目名称', '项目编号', '产品功能类别', '产品管控等级']) {
    assert.ok(!new RegExp(`putIfVal\\(draft, "${absent}"`).test(buttons),
      `规格书没有「${absent}」这个字段，不该出现在草稿映射里`)
  }
})
