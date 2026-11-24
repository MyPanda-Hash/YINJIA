/**
 * changeCosign.test.js —— 产品变更申请表「会签人填本部门行 + 管理员终审」的钉子
 *
 * 用户口径（2026-11-19）：
 *   「产品变更申请表，现在会签人只能点会签通过，但是不能填对应的部门评审意见，
 *     所有会签人会签通过之后，由管理员进行一个最终的审批然后归档，
 *     管理员的签字日期也要显示在这里」
 *
 * 已确认：
 *   ① 管理员 = admin 账号；
 *   ② 会签人只能编辑自己部门那一行（变更/新增申请内容 + 签字 + 日期），其他行只读；
 *   ③ 会签全部通过 → 单据进入「待批准」→ 只有 admin 看到「批准/驳回」；
 *   ④ 点批准时自动写入 admin 姓名（系统管理员）+ 当天日期到「批准/签字/日期」三格，然后归档。
 *
 * 本文件分两层：
 *   ① 纯函数（changeCosign.js）—— 权限/按钮可见性契约，可独立断言；
 *   ② 源码钉子 —— 后端门禁在 Spring/JDBC 内部，仓库没有 Spring 测试基座
 *      （沿用 changeSignoffStamp.test.js / approvalSeparation.test.js 的既有做法）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { recordSheetConfigs } from './recordSheetConfigs.js'
import {
  CHANGE_PANEL_CODE,
  CHANGE_SIGNOFF_STATUS,
  CHANGE_FINAL_STATUS,
  splitChangeSigners,
  isChangeSigner,
  canFillOwnDeptRow,
  isChangeFinalStage,
  canFinalApprove,
  changeApproveLabel,
  changeRejectLabel,
  changeWaitingTip,
} from './changeCosign.js'

const ROOT = new URL('../../../', import.meta.url) // frontend/
const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8')
const panelx = read('src/core/views/PanelxList.vue')
const button = read('../backend/src/main/java/com/yinjia/mes/service/ButtonService.java')
const query = read('../backend/src/main/java/com/yinjia/mes/service/QueryService.java')
const en = read('src/i18n/locales/en.js')
const manifest = read('../tools/db-migrations.txt')
const migration = read('../tools/migrate-change-cosign-20261119.sql')

// ── 一、纯函数：会签人 / 本部门行 / 终审按钮 ────────────────────────────────
test('会签人账号串解析：逗号/顿号/分号/空白都认，去重前的空项剔除', () => {
  assert.deepEqual(splitChangeSigners('cp、glm53, liulei;fengmin  '), ['cp', 'glm53', 'liulei', 'fengmin'])
  assert.deepEqual(splitChangeSigners(''), [])
  assert.deepEqual(splitChangeSigners(null), [])
})

test('会签人身份：只认「会签人」字段里的账号，账号为空一律不是', () => {
  const head = { 会签人: 'cp、glm53' }
  assert.equal(isChangeSigner(head, 'cp'), true)
  assert.equal(isChangeSigner(head, 'admin'), false)
  assert.equal(isChangeSigner(head, ''), false)
  assert.equal(isChangeSigner(null, 'cp'), false)
})

test('会签中填本部门行：面板 + 状态 + 会签人 + 有部门映射，四条同时成立才放行', () => {
  const base = { panelCode: 'RD_CHANGE', status: '会签中', head: { 会签人: 'cp' }, account: 'cp', deptRows: ['品质部'] }
  assert.equal(canFillOwnDeptRow(base), true)
  assert.equal(canFillOwnDeptRow({ ...base, panelCode: 'RD_APPROVAL' }), false)
  assert.equal(canFillOwnDeptRow({ ...base, status: '草稿' }), false)
  assert.equal(canFillOwnDeptRow({ ...base, status: '待批准' }), false)
  assert.equal(canFillOwnDeptRow({ ...base, account: 'glm53' }), false)
  assert.equal(canFillOwnDeptRow({ ...base, deptRows: [] }), false)
  // 管理员不是会签人时同样不能走这个口子（管理员终审走「批准」，不填部门意见）
  assert.equal(canFillOwnDeptRow({ ...base, account: 'admin' }), false)
})

test('待批准节点：只有 admin 能批准/驳回，其他账号看不到按钮', () => {
  assert.equal(isChangeFinalStage('RD_CHANGE', '待批准'), true)
  assert.equal(isChangeFinalStage('RD_CHANGE', '审批中'), false)
  assert.equal(isChangeFinalStage('RD_APPROVAL', '待批准'), false)
  assert.equal(canFinalApprove({ panelCode: 'RD_CHANGE', status: '待批准', isAdmin: true }), true)
  assert.equal(canFinalApprove({ panelCode: 'RD_CHANGE', status: '待批准', isAdmin: false }), false)
  assert.equal(canFinalApprove({ panelCode: 'RD_CHANGE', status: '审批中', isAdmin: true }), false)
  assert.equal(canFinalApprove({ panelCode: 'RD_PROD_INFO', status: '待批准', isAdmin: true }), false)
})

test('按钮文案与等待提示：待批准用「批准通过/批准驳回」，其余保持原样', () => {
  assert.equal(changeApproveLabel(true), '批准通过')
  assert.equal(changeApproveLabel(false), '审批通过')
  assert.equal(changeRejectLabel(true), '批准驳回')
  assert.equal(changeRejectLabel(false), '审批驳回')
  assert.match(changeWaitingTip('待批准'), /管理员/)
  assert.match(changeWaitingTip('审批中'), /审批人/)
})

// ── 二、纸面：部门评审意见那张表就是「会签人要填的那一行」 ────────────────
test('RD_CHANGE「三、部门评审意见」表：按部门锁行，可编列是 变更后内容/备注', () => {
  const dt = (recordSheetConfigs.RD_CHANGE.dataTables || [])[0]
  assert.ok(dt, '部门评审意见表缺失')
  assert.equal(dt.bar, '三、部门评审意见')
  assert.equal(dt.lockKey, '部门')
  assert.ok((dt.lockCols || []).includes('变更后内容'), '会签人要能填「变更/新增申请内容」')
  const keys = (dt.cols || []).map((c) => c.key)
  for (const k of ['部门', '变更后内容', '签字', '日期']) assert.ok(keys.includes(k), `缺列：${k}`)
})

// ── 三、前端接线：会签中可编本部门行；待批准只有 admin 看到批准/驳回 ──────
test('前端：会签中也走「本部门行」窄口子，且 admin 在该模式也受部门行约束', () => {
  assert.match(panelx, /canFillOwnDeptRow/, 'PanelxList 必须复用纯函数判定')
  assert.match(panelx, /const changeSignoffFillOpen = computed\(/, '缺少会签中填本部门行的 computed')
  assert.match(panelx, /const changeRowEditOpen = computed\(\(\) => changeDeptFillOpen\.value \|\| changeSignoffFillOpen\.value\)/,
    '两种窄口子（会签中 / 已生效后）要合成一个行编辑开关')
  assert.match(panelx, /:dept-fill-open="changeRowEditOpen"/, '纸面要收到合成后的行编辑开关')
  assert.match(panelx, /:dept-lock-all="user\.isAdmin === true && !changeSignoffFillOpen"/,
    '会签中管理员若也是会签人，也必须只编自己部门那一行，不能借 admin 豁免全表')
})

test('前端：会签中点「会签通过」前先落库，且保存/保存按钮对会签窄口子放行', () => {
  assert.match(panelx, /action === '会签通过' && \(draftEditable\.value \|\| changeSignoffFillOpen\.value\)/,
    '「会签通过」前必须先保存刚填的部门意见')
  assert.match(panelx, /const sheetSideGroups = computed\(\(\) => approvalSideGroups\.value[\s\S]{0,400}?!changeRowEditOpen\.value/,
    '侧栏按钮过滤要认会签窄口子（否则「保存」在会签中被撤掉）')
  assert.match(panelx, /if \(\(!draftEditable\.value && !changeRowEditOpen\.value\) \|\| inlineSaving\.value\) return false/,
    'saveInlineDraft 的门禁要认合成后的行编辑开关')
})

test('前端：待批准进入审批状态集合，按钮可见性只给 admin，文案切「批准/驳回」', () => {
  assert.match(panelx, /const IN_APPROVAL = \['审批中', '待二级审批', '待批准'\]/, 'IN_APPROVAL 要含待批准')
  assert.match(panelx, /changeFinalStage\.value\s*\?\s*user\.isAdmin === true/, '待批准节点只让 admin 看到按钮')
  assert.match(panelx, /changeApproveLabel\(true\)/, '批准按钮文案要按节点切换')
  assert.match(panelx, /changeRejectLabel\(true\)/, '驳回按钮文案要按节点切换')
  assert.match(panelx, /仅管理员可执行最终批准/, '非 admin 点批准要有明确原因（即使按钮不显示）')
  assert.match(panelx, /会签人可在「三、部门评审意见」填写本部门那一行/, '侧栏要告诉会签人能填哪里')
})

test('前端：admin 批准弹窗不再让人改签字/日期，改为固定展示并自动回填', () => {
  const at = panelx.indexOf('chgApvVisible')
  const seg = panelx.slice(at, at + 5000)
  assert.ok(at > 0, '缺少 admin 批准弹窗')
  assert.doesNotMatch(seg, /v-model="chgApvSign"/, '签字不再由弹窗手填（用户口径：自动写入 admin 姓名）')
  assert.doesNotMatch(seg, /v-model="chgApvDate"/, '日期不再由弹窗手填（用户口径：自动写入当天日期）')
  assert.match(seg, /user\?*\.realName/, '弹窗要显示将回填的 admin 姓名')
  assert.match(seg, /todayStr\(\)/, '弹窗要显示将回填的当天日期')
  assert.match(seg, /批准后系统自动写入/, '弹窗要说清自动回填')
})

// ── 四、后端：服务端校验只能改自己部门那一行（不能只靠界面置灰）─────────
test('后端：会签中保存只放行「本单待签 + 有部门映射」的账号，且只写明细', () => {
  const fn = button.match(/private boolean allowChangeSignoffFill\([\s\S]*?\n    \}/)
  assert.ok(fn, '缺少 allowChangeSignoffFill')
  const body = fn[0]
  assert.match(body, /CHANGE_PANEL\.equals\(def\.code\(\)\)/, '先卡面板')
  assert.match(body, /"会签中"\.equals/, '只在会签中放行')
  assert.match(body, /"PENDING"\.equals\(signoffResults\(no\)\.get\(user\)\)/, '必须还有本账号的待签记录')
  assert.match(body, /!changeDeptsOf\(user\)\.isEmpty\(\)/, '必须有部门映射才能填本部门行')

  assert.match(button, /signoffFillOnly = allowChangeSignoffFill\(/, 'saveDoc 要调用该判定')
  assert.match(button, /deptFillOnly = true/, '会签窄口子也只写明细')
  assert.match(button, /if \(markSaved && !signoffFillOnly\)/, '会签填意见不跑「提交」级必填')
  assert.match(button, /gateChangeDetail\(def, items, no, user, signoffFillOnly\)/, '按格门禁要收到严格模式')
  assert.match(button, /if \(!deptFillOnly\) upsertHeadRow\(/, '会签人不能顺手改表头')
})

test('后端：严格模式下 admin 也不能编别人的部门行；载荷里的签字/日期会被还原', () => {
  const fn = button.match(/private void gateChangeDetail\([\s\S]*?\n    \}/)
  assert.ok(fn, '缺少 gateChangeDetail')
  assert.match(fn[0], /boolean strictOwnOnly/, '门禁要能区分「管理员豁免」与「只能自己部门」')
  assert.match(fn[0], /boolean admin = !strictOwnOnly && isAdminUser\(user\)/, '严格模式关掉 admin 的行豁免')
  assert.match(fn[0], /restoreRow\(cur, it, own\)/, '非本部门行的列一律还原')
})

test('后端：会签全过 → 待批准（pending=Y + approve_node=2），不再直接进「审批中」', () => {
  const fn = button.match(/private Map<String, Object> submitChangeFinalApproval\([\s\S]*?\n    \}/)
  assert.ok(fn, '缺少 submitChangeFinalApproval')
  const body = fn[0]
  assert.match(body, /approve_node = 2/, '沿用两级审批的 approve_node 表示最终节点')
  assert.match(body, /recordApproval\(def\.code\(\), no, "SUBMIT", "PENDING"/, '留提交痕')
  assert.match(body, /messageService\.admins\(\)/, '通知管理员待批准')
  const signoff = button.match(/private Map<String, Object> signoffApprove\([\s\S]*?\n    \}/)
  assert.ok(signoff, '缺少 signoffApprove')
  assert.match(signoff[0], /submitChangeFinalApproval\(def, no, opinion\)/, '会签全过必须走最终提交')
  assert.match(signoff[0], /return result\(no, "待批准"\)/, '返回状态必须是待批准')
})

test('后端：只有 admin 能批准/驳回待批准单；批准自动回填姓名+当天并归档', () => {
  const approve = button.match(/private Map<String, Object> approveChangeFinal\([\s\S]*?\n    \}/)
  assert.ok(approve, '缺少 approveChangeFinal')
  const a = approve[0]
  assert.match(a, /if \(!isAdminUser\(operator\)\)/, '批准仅 admin')
  assert.match(a, /writeChangeApprovalSign\(def, no, operator\)/, '回填批准三格')
  assert.match(a, /effective = 'Y'/, '生效')
  assert.match(a, /markArchived\(def\.code\(\), no, operator\)/, '归档')
  assert.match(a, /applyChangeEffect\(no, operator\)/, '沿用既有生效钩子建下一版草稿')

  const reject = button.match(/private Map<String, Object> rejectChangeFinal\([\s\S]*?\n    \}/)
  assert.ok(reject, '缺少 rejectChangeFinal')
  assert.match(reject[0], /if \(!isAdminUser\(who\)\)/, '驳回仅 admin')
  assert.match(reject[0], /opinion\.isEmpty\(\)/, '驳回必须填意见')
  assert.match(reject[0], /notifyChangeRejected\(def, no, who, opinion\)/, '驳回通知既有口径')

  assert.match(button, /if \(node == 2 && CHANGE_PANEL\.equals\(def\.code\(\)\)\)\s*\{?\s*return approveChangeFinal\(/,
    'approveApproval 的 node=2 分支要分流转给最终批准')
  assert.match(button, /if \(node == 2 && CHANGE_PANEL\.equals\(def\.code\(\)\)\)\s*\{?\s*return rejectChangeFinal\(/,
    'rejectApproval 的 node=2 分支要分流转给最终驳回')
})

test('后端：批准签字/日期不再信任前端载荷，固定写 admin 姓名 + 当天', () => {
  const fn = button.match(/private void writeChangeApprovalSign\([\s\S]*?\n    \}/)
  assert.ok(fn, '缺少 writeChangeApprovalSign')
  const body = fn[0]
  assert.match(body, /signNameOf\(operator\)/, '姓名取当前操作人（admin = 系统管理员）')
  assert.doesNotMatch(body, /pickOf\(formData, "批准签字"\)/, '不再接受前端传的签字')
  assert.doesNotMatch(body, /pickOf\(formData, "批准日期"\)/, '不再接受前端传的日期')
  assert.match(body, /LocalDate\.now\(\)\.toString\(\)/, '日期固定当天')
  assert.match(body, /备用2 = \?, 备用3 = \?, 备用4 = \?/, '三格仍落在备用列池')
})

test('后端：两处状态推导都认「待批准」（列表行 + 按钮/保存门禁）', () => {
  assert.match(button, /CHANGE_PANEL\.equals\(panelCode\) \? "待批准" : "待二级审批"/,
    'ButtonService.docStatusOf 要区分 RD_CHANGE 的最终节点')
  assert.match(query, /"RD_CHANGE"\.equals\(panelCode\) \? "待批准" : "待二级审批"/,
    'QueryService.docStatus 要同口径（两处必须同改）')
  assert.match(button, /"待批准"\.equals\(stStatus\)/, '待批准时保存要挡住')
})

// ── 五、迁移：三格/明细列/字段登记/注释/自检，幂等且已登记 ─────────────────
test('迁移落在 tools/ 且登记进 db-migrations.txt', () => {
  assert.ok(existsSync(new URL('../tools/migrate-change-cosign-20261119.sql', ROOT)), '迁移文件不存在')
  assert.match(manifest, /migrate-change-cosign-20261119\.sql/, 'db-migrations.txt 未登记迁移（部署不会执行）')
})

test('迁移幂等要点：缺列才加、字段只补不覆盖、三格只读、带自检', () => {
  assert.match(migration, /COL_LENGTH\('rd_change_detail', '变更后内容'\)/, '要守卫明细列是否存在')
  assert.match(migration, /COL_LENGTH\('rd_change_head', '备用2'\)/, '要守卫批准三格列')
  assert.match(migration, /WHERE NOT EXISTS \(SELECT 1 FROM yj_field x WHERE x\.panel_code = N'RD_CHANGE' AND x\.col_name = a\.col\)/, '批准三格字段要幂等补登')
  assert.match(migration, /editable = 0/, '批准三格必须只读（只有审批动作写得进去）')
  assert.match(migration, /MS_Description/, '动过的列要补说明')
  assert.match(migration, /自检/, '迁移要带自检')
})

test('多语言：新增 UI 文案至少有 en 词条', () => {
  for (const key of [
    '会签人可在「三、部门评审意见」填写本部门那一行',
    '本单会签已全部通过，等待管理员批准',
    '仅管理员可执行最终批准',
    '批准后系统自动写入',
  ]) {
    assert.ok(en.includes(`'${key}`), `en.js 缺少词条：${key}`)
  }
})
