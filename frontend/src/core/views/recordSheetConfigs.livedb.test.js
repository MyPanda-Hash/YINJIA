/**
 * recordSheetConfigs 活库契约单测 —— 配置里的每个面板必须在活库里真实存在,且 key == 活库当前 label
 *
 * 【为什么不复用 recordSheetConfigs.keys.test.js】
 *   keys.test.js 的基线是 `rdPanelLabels.fixture.json`,那是**离线快照**。
 *   快照会过期:fixture 停在某个日期,而活库 label 已经改了 ⇒ 测试在**旧世界上通过**,
 *   真实故障照样发生(本仓已有先例,见 keys.test.js :13-15「改 label 就是改数据键」)。
 *   本文件的存在理由就是**绕过快照,直查活库**。
 *
 * 【为什么连不上库要 fail 而不是 skip】
 *   静默跳过 = 假绿。CI 上"测试通过"但什么都没验,比测试红着更危险
 *   (见 docs/development/开发与质量.md §5.5 「静默失败比报错危险」)。
 *   所以连不上直接抛 —— 要么修连接,要么显式删掉这条测试并说明理由。
 *
 * 【本次覆盖范围】
 *   `mode='archive'` 的面板在 RD_ 命名空间下**只有 2 张**:
 *     RD_SHARE_FILE(共享文件库) / RD_SINTER_TOL(烧结尺寸表)。
 *   全库 archive 共 36 张,其余 34 张的数据键不走 recordSheetConfigs.js(走 ArchivePanel 系列),
 *   不在本文件范围。见 AGENTS 任务记录「archive 面板数据键断言」。
 *
 *   ⚠ 这两个面板曾被误记为「档案式面板共 23 张」——实测 HSDZ_MES 只有 2 张在 RD 命名空间,
 *     不要把本测试的期望表扩成 23/36,那会守到别的文件上去。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { recordSheetConfigs } from './recordSheetConfigs.js'

/** 2026-10-xx 实测:RD_ 命名空间下 mode='archive' 的面板 = 恰好这 2 张 */
const ARCHIVE_PANELS = ['RD_SHARE_FILE', 'RD_SINTER_TOL']

/**
 * 每个 archive 面板的**期望字段键** = 该面板当前 yj_field.label 全集。
 *
 * 这两张面板的 col_name 与 label **完全相同**(实测),所以期望表就是 label 表。
 * 一旦将来某字段 label 与 col_name 分叉,本表**必须跟着改**——
 * 因为前端行模型是 `{ [label]: value }`,配置只能写 label。
 */
const EXPECTED_LABELS = {
  RD_SHARE_FILE: ['文件'],
  RD_SINTER_TOL: [
    '车间', '型号', '模具尺寸', '中心杆尺寸', '炭棒外径',
    '炭棒外径公差', '炭棒内径', '炭棒内径公差', '长度范围', '停用',
  ],
}

const SQLCMD = 'C:\\Program Files\\Microsoft SQL Server\\Client SDK\\ODBC\\170\\Tools\\Binn\\SQLCMD.EXE'
const DB = { server: 'localhost', database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026' }

/**
 * sqlcmd 的 stdout 编码随版本/区域设置变(实测同一台机器 170 版可能给 UTF-8 也可能给 GBK),
 * **不能写死**。策略:两种都解,取**不含替换字符 U+FFFD** 的那个。
 * 两个都含 U+FFFD 就抛 —— 宁可红,也不要在乱码上"通过"(见 §5.5 C7:GBK 字节写进 UTF-8 文件
 * 回写后永久变 U+FFFD,不可逆)。
 */
function decodeSqlcmd(raw) {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(raw)
  const gbk = new TextDecoder('gbk', { fatal: false }).decode(raw)
  const bad = (s) => s.includes('\uFFFD')
  if (!bad(utf8)) return utf8
  if (!bad(gbk)) return gbk
  throw new Error('sqlcmd 输出既非合法 UTF-8 也非合法 GBK,拒绝在乱码上断言')
}

/**
 * 直查活库。连不上就抛(不返回空、不 skip)——见文件头「为什么连不上库要 fail」。
 * @param {string} sql 单条 SELECT,结果按 `\t` 分隔、无表头
 */
function queryLive(sql) {
  let raw
  try {
    raw = execFileSync(SQLCMD, [
      '-S', DB.server, '-d', DB.database, '-U', DB.user, '-P', DB.password,
      '-W', '-s', '\t', '-h', '-1', '-Q', `SET NOCOUNT ON; ${sql}`,
    ], { encoding: 'buffer', timeout: 30000 })
  } catch (e) {
    throw new Error(
      `连不上活库 ${DB.server}/${DB.database}(本测试要求直查活库,不静默跳过)。\n` +
      `排查:① SQL Server 是否在跑 ② 后端 start-prod.ps1 是否起过 ③ 口令是否已轮换。\n` +
      `原始错误: ${e.message}`,
    )
  }
  const text = decodeSqlcmd(raw)
  if (/消息 \d+|Msg \d+|错误/.test(text)) {
    throw new Error(`查活库报错:\n${text.trim()}`)
  }
  return text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0)
}

test('活库可连通(连不上直接 fail,不静默跳过)', () => {
  const rows = queryLive('SELECT 1;')
  assert.equal(rows[0], '1', `活库连通性探针返回异常: ${JSON.stringify(rows)}`)
})

test('RD_ 命名空间下 mode=archive 的面板就是本测试登记的这 2 张', () => {
  const rows = queryLive(
    "SELECT panel_code FROM yj_panel WHERE mode='archive' AND panel_code LIKE 'RD[_]%' ORDER BY panel_code;",
  )
  assert.deepEqual(
    rows, ARCHIVE_PANELS,
    '活库里 RD 命名空间的 archive 面板集合变了 —— 要么新增的面板需要写配置并登记进 EXPECTED_LABELS,' +
    '要么面板 mode 被改错了',
  )
})

test('配置里每个 archive 面板都必须在活库存在且 mode=archive', () => {
  const problems = []
  for (const panel of ARCHIVE_PANELS) {
    if (!recordSheetConfigs[panel]) {
      problems.push(`${panel} 未登记进 recordSheetConfigs.js(本测试已把这个面板纳入范围)`)
      continue
    }
    const rows = queryLive(
      `SELECT mode FROM yj_panel WHERE panel_code='${panel}';`,
    )
    if (rows.length === 0) {
      problems.push(`${panel} 在活库 yj_panel 里不存在`)
    } else if (rows[0] !== 'archive') {
      problems.push(`${panel} 活库 mode='${rows[0]}',期望 'archive'`)
    }
  }
  assert.deepEqual(problems, [], `archive 面板登记与活库不符:\n  ${problems.join('\n  ')}`)
})

test('archive 面板配置里的每个 key 都必须是活库当前的 yj_field.label', () => {
  const problems = []
  for (const panel of ARCHIVE_PANELS) {
    const cfg = recordSheetConfigs[panel]
    if (!cfg) continue

    // 活库真实 label 全集
    const liveLabels = new Set(queryLive(
      `SELECT label FROM yj_field WHERE panel_code='${panel}' AND ISNULL(visible,1)=1 ORDER BY seq;`,
    ))

    for (const key of collectKeys(cfg)) {
      if (key === '表区') continue
      if (liveLabels.has(key)) continue
      problems.push(`${panel} · key='${key}' 在活库 yj_field.label 里找不到 ⇒ 取值恒 undefined 且保存静默丢值`)
    }
  }
  assert.deepEqual(problems, [], `配置数据键与活库 yj_field.label 不一致:\n  ${problems.join('\n  ')}`)
})

test('EXPECTED_LABELS 期望表与活库一致(防期望表自己过期)', () => {
  const problems = []
  for (const panel of ARCHIVE_PANELS) {
    const live = queryLive(
      `SELECT label FROM yj_field WHERE panel_code='${panel}' AND ISNULL(visible,1)=1 ORDER BY seq;`,
    )
    const expected = EXPECTED_LABELS[panel]
    if (JSON.stringify(live) !== JSON.stringify(expected)) {
      problems.push(
        `${panel} 活库 label 已变:\n      活库 = ${JSON.stringify(live)}\n      期望 = ${JSON.stringify(expected)}`,
      )
    }
  }
  assert.deepEqual(problems, [], `期望表过期(改字段后须同步本文件):\n  ${problems.join('\n  ')}`)
})

/** 递归收集配置里所有数据键(与 keys.test.js 的口径一致:dataTables.cols / sections.rows / variants.cols / cover) */
function collectKeys(cfg) {
  const keys = []
  for (const dt of cfg.dataTables || []) {
    for (const c of dt.cols || []) if (c.key) keys.push(c.key)
  }
  for (const sec of [...(cfg.sections || []), ...(cfg.tailSections || [])]) {
    for (const row of sec.rows || []) {
      if (row.key) keys.push(row.key)
      for (const cell of row.cells || []) if (cell.key) keys.push(cell.key)
      for (const cell of row.grid || []) if (cell.key) keys.push(cell.key)
    }
  }
  for (const v of Object.values(cfg.variants || {})) {
    for (const c of v.cols || []) if (c.key) keys.push(c.key)
  }
  return keys
}
