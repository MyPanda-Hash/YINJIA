/**
 * specDriftNotice.test.js —— 「引用单据上的规格书漂移提示」+「四文件弃审放宽」的钉子(2026-10-16)
 *
 * 【用户原话】「现在产品信息表分发下去的 4 类单据没有反审核,也就是弃审,写错了改不了,申请修改是否能用……
 *   有一些单据是引用的规格书的数据,要是规格书申请修改数据了,但是其他的引用数据的单据是归档状态……
 *   应该有一个提示,提示说单据对应的规格书申请修改了数据,请及时核对,这些单据也可以对应的反审核
 *   然后重新引用数据」
 *
 * 【实测(测试账套端到端,见 tools/archive/_probe-spec-drift/)】改动前:文件责任人(柴善银,角色
 *   「文件负责人」只有 add/modify)点弃审被**前门**挡下 —— 「当前角色无该面板「审批」权限,无法执行「弃审」」;
 *   放宽后:责任人 code=200,非责任人(刘磊)仍 403「只有该文件的责任人（或管理员）可以编辑」。
 *   漂移提示:规格书「修改申请中」时接口 needCheck=true/reason=spec_in_flux,黄条照上面那句给下一步。
 *
 * 单测跑不了运行时,按仓库既有做法读源码钉住(同 rdChangeConfig.test.js)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const panelx = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
const engine = readFileSync(new URL('../../business/engine.js', import.meta.url), 'utf8')
const en = readFileSync(new URL('../../i18n/locales/en.js', import.meta.url), 'utf8')
const buttons = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')
const perms = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/PanelPermissionService.java', import.meta.url), 'utf8')
const controller = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/controller/PxController.java', import.meta.url), 'utf8')

// ── 一、弃审放宽:前门(权限表) + 身份门禁(责任人)两层都要改,少一层就等于没放 ──
test('前门放行:四文件面板的「弃审」不再只吃 audit 词', () => {
  assert.match(perms, /for \(String p : new String\[\]\{"RD_SPEC_DOC", "RD_MOLD_PROC", "RD_ASM_PROC", "RD_INSP_PLAN"\}\) \{\s*\n\s*m\.put\(p \+ "\|弃审", new String\[\]\{"add", "modify", "audit"\}\);/,
    '只有放开前门,文件责任人(角色仅有 add/modify)才走得到后端')
  // 反例守卫:别把整张表都改判成 add/modify(那会让"有编辑权的人"都能弃审别的面板)
  assert.ok(!/m\.put\("弃审", new String\[\]\{"add"/.test(perms), '全局「弃审」仍应吃 audit 词')
})

test('身份门禁:四文件面板弃审 = 审批权 ∪ 该文件责任人,其余面板一字不动', () => {
  assert.match(buttons, /if \(DevTaskService\.devPanelCodes\(\)\.contains\(def\.code\(\)\)\) requireApproverOrDevFileOwner\(def, no\);\s*\n\s*else requireApprover\(def\.code\(\)\);/,
    'unaudit 要按面板分流:四文件走责任人闸门,其余面板维持 requireApprover')
  assert.match(buttons, /private void requireApproverOrDevFileOwner\(PanelRegistry\.PanelDef def, String no\) \{[\s\S]{0,400}?devFileEditVerdict\(def, no, null, user\)/,
    '责任人判定必须复用保存门禁的同一真源 devFileEditVerdict(能改这张单的人才能退回来改)')
})

// ── 二、漂移判定:两种口径 + 两个必须避开的坑 ──
test('规格书漂移判定:只对三个引用方生效', () => {
  assert.match(buttons, /SPEC_REF_PANELS = java\.util\.Set\.of\("RD_MOLD_PROC", "RD_ASM_PROC", "RD_INSP_PLAN"\)/)
  assert.match(buttons, /out\.put\("applicable", SPEC_REF_PANELS\.contains\(panelCode\)\)/)
  // 规格书自己是数据源,不能被当成引用方(方向相反)
  assert.ok(!/SPEC_REF_PANELS = java\.util\.Set\.of\("RD_SPEC_DOC"/.test(buttons))
})

test('「规格书正在改」⇒ spec_in_flux;「规格书改完且比本单新」⇒ spec_newer', () => {
  assert.match(buttons, /"not_approved"\.equals\(nz\(spec\.get\("reason"\)\)\)[\s\S]{0,300}?out\.put\("reason", "spec_in_flux"\)/)
  assert.match(buttons, /specAt\.compareTo\(docAt\) > 0[\s\S]{0,200}?out\.put\("reason", "spec_newer"\)/)
})

test('比时间必须用 update_at,不能用 archived_at(后者"仅首次归档"写入,永远比不出来)', () => {
  assert.match(buttons, /statusUpdateAt\(String panelCode, String docNo\)[\s\S]{0,300}?CONVERT\(nvarchar\(19\), update_at, 120\)/)
  assert.ok(!/specNewer[\s\S]{0,200}?archived_at/.test(buttons), '漂移比较里不该出现 archived_at')
})

test('str() 对空值返回 null ⇒ 判空前必须过 nz()(端到端跑出过 500 NPE)', () => {
  assert.match(buttons, /private static String nz\(Object o\) \{\s*\n\s*String s = str\(o\);\s*\n\s*return s == null \? "" : s;/)
  assert.match(buttons, /String specNo = nz\(spec\.get\("单据编号"\)\)/, 'specDriftState 里取编号必须用 nz')
  assert.match(buttons, /String blocked = nz\(spec\.get\("规格书编号"\)\)/)
})

test('端点 + 前端 API + 前端加载时机', () => {
  assert.match(controller, /@GetMapping\("\/rdDev\/specDrift"\)[\s\S]{0,200}?buttons\.specDriftState\(panelCode, docNo\)/)
  assert.match(engine, /export async function rdSpecDrift\(panelCode, docNo\)/)
  assert.match(panelx, /const SPEC_REF_PANELS = \['RD_MOLD_PROC', 'RD_ASM_PROC', 'RD_INSP_PLAN'\]/)
  assert.match(panelx, /loadRdFlowState\(\); loadPendingDocs\(\); loadSpecDrift\(\); loadProdDrift\(\) \}/,
    '切单据的 watch 里必须带上 loadSpecDrift/loadProdDrift —— 否则黄条永远不出现')
})

// ── 三、黄条与弃审入口(界面层) ──
test('黄条:文案 + 下一步 + 样式', () => {
  assert.match(panelx, /<div v-if="specDrift" class="spec-drift-banner">/)
  assert.match(panelx, /本单引用的规格书 \{no\} 正在修改（\{st\}），请及时核对数据/)
  assert.match(panelx, /本单引用的规格书 \{no\} 已更新（\{t\}），请及时核对数据/)
  assert.match(panelx, /如数据已变：点侧栏「弃审」退回草稿 → 再点「按规格书带入」取最新数据/)
  assert.match(panelx, /\.spec-drift-banner \{[\s\S]{0,300}?border-left: 3px solid #e6a23c/)
})

test('责任人能看到「弃审」(canUnauditHere 用与保存门禁同源的 canEdit)', () => {
  assert.match(panelx, /const devFileCanEditHere = computed\(\(\) => !!\(devFileGate\.value\?\.applicable && devFileGate\.value\?\.canEdit === true\)\)/)
  assert.match(panelx, /canApproveHere\(\) \|\| devFileCanEditHere\.value\)/)
})

test('新增 UI 文案都有多语言词条(en 至少)', () => {
  for (const k of ["'规格书已变动':", "'本单引用的规格书 {no} 正在修改（{st}），请及时核对数据':",
    "'本单引用的规格书 {no} 已更新（{t}），请及时核对数据':",
    "'如数据已变：点侧栏「弃审」退回草稿 → 再点「按规格书带入」取最新数据':"]) {
    assert.ok(en.includes(k), `en.js 缺词条：${k}`)
  }
})

// ── 四、产品信息表漂移(2026-10-16 用户口径:「产品信息表要是申请修改怎么办,那些引用产品信息表的
//        怎么办?应该也做一个提示通知」)—— 与规格书那条同构,两个层次:页面黄条 + 消息中心通知 ──
test('产品信息表漂移:四个引用方(含规格书本身)按产品编号关联', () => {
  assert.match(buttons, /PRODINFO_REF_PANELS = java\.util\.Set\.of\(\s*\n?\s*"RD_SPEC_DOC", "RD_MOLD_PROC", "RD_ASM_PROC", "RD_INSP_PLAN"\)/)
  assert.match(buttons, /out\.put\("applicable", PRODINFO_REF_PANELS\.contains\(panelCode\)\)/)
  assert.match(buttons, /out\.put\("reason", "prod_in_flux"\)/, '正在改(修改申请中/修改中)⇒ prod_in_flux')
  assert.match(buttons, /out\.put\("reason", "prod_reaudited"\)/, '被弃审退回草稿 ⇒ prod_reaudited(靠 UNAUDIT 留痕区分新建草稿)')
  assert.match(buttons, /prodAt[\s\S]{0,120}?compareTo\(docAt\) > 0[\s\S]{0,120}?out\.put\("reason", "prod_newer"\)|pa\.compareTo\(da\) > 0[\s\S]{0,160}?out\.put\("reason", "prod_newer"\)/)
  assert.match(buttons, /CONVERT\(nvarchar\(19\), update_at, 120\)/, '比时间仍走 update_at(不能用 archived_at)')
  assert.match(buttons, /WHERE panel_code = \? AND form_no = \? AND action = 'UNAUDIT'/,
    '弃审留痕的列名是 form_no(写 doc_no 会被 catch 吞掉,标记恒 false)')
})

test('产品信息表漂移:端点 + 前端 API + 黄条三档文案 + 词条', () => {
  assert.match(controller, /@GetMapping\("\/rdDev\/prodInfoDrift"\)[\s\S]{0,200}?buttons\.prodInfoDriftState\(panelCode, docNo\)/)
  assert.match(engine, /export async function rdProdInfoDrift\(panelCode, docNo\)/)
  assert.match(panelx, /const PRODINFO_REF_PANELS = \['RD_SPEC_DOC', 'RD_MOLD_PROC', 'RD_ASM_PROC', 'RD_INSP_PLAN'\]/)
  assert.match(panelx, /<div v-if="prodDrift" class="spec-drift-banner">/)
  assert.match(panelx, /本单引用的产品信息表 \{no\} 正在修改（\{st\}），请及时核对数据/)
  assert.match(panelx, /本单引用的产品信息表 \{no\} 已被反审核退回草稿，请核对数据/)
  assert.match(panelx, /本单引用的产品信息表 \{no\} 已更新（\{t\}），请及时核对数据/)
  for (const k of ["'产品信息表已变动':", "'本单引用的产品信息表 {no} 正在修改（{st}），请及时核对数据':",
    "'本单引用的产品信息表 {no} 已被反审核退回草稿，请核对数据':",
    "'本单引用的产品信息表 {no} 已更新（{t}），请及时核对数据':",
    "'如数据已变：点侧栏「弃审」退回草稿 → 重新按产品信息表核对后再归档':"]) {
    assert.ok(en.includes(k), `en.js 缺词条：${k}`)
  }
})

test('产品信息表漂移:申请修改 / 弃审两条路都要通知四文件责任人(消息中心)', () => {
  assert.match(buttons, /MessageService\.PRODINFO_CHANGED/, '消息码要有出处')
  assert.match(buttons, /if \("RD_PROD_INFO"\.equals\(def\.code\(\)\)\) notifyProdInfoChanged\(no, user, reason\);/,
    '申请修改路径要发通知')
  assert.match(buttons, /if \("RD_PROD_INFO"\.equals\(def\.code\(\)\)\) notifyProdInfoChanged\(no, currentUserName\(\), "弃审"\);/,
    '弃审路径要发通知(放在 recordApproval(UNAUDIT) 之后,漂移判定靠这条留痕)')
  assert.match(buttons, /SELECT DISTINCT \[负责人\] FROM rd_dev_task WHERE \[产品编号\] = \?/,
    '收件人 = 该产品四个文件的负责人(rd_dev_task)')
  const notice = readFileSync(new URL('../../layout/NoticeCenter.vue', import.meta.url), 'utf8')
  assert.match(notice, /PRODINFO_CHANGED: \{ title: '产品信息表已变动'/, '消息中心要有模板,否则渲染成通用「业务消息」')
})
