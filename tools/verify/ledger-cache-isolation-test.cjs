/* 回归:后端**元数据类缓存必须按账套隔离**(技术债 #11)
   用法: node tools/verify/ledger-cache-isolation-test.cjs       (需 8090 在跑)
   背景:ADR-0003 两账套共用一套后端进程,`yj_panel`/`yj_field`/`yj_translation` 都是**分账套**的。
        `PanelRegistry` 与 `TranslationService` 的缓存曾经只按「面板/TTL」和「语言」做键、
        没有账套维度 ⇒ 两个账套共用一份,「谁先刷新谁说了算」——
        症状是在**测试账套**新增/改了面板、字段或译名,接口看不见(2026-09-22 定位并修复)。

   判据(等价于"缓存按账套隔离"):
     ① 面板元数据:测试库独有的标记面板 → YJ 必须 400、YJ_TEST 必须 200(×3 轮);
     ② 译名:测试库独有的面板名译名  → YJ 不得出现该译名、YJ_TEST 必须出现(×3 轮);
     ③ 负向对照:两账套都有的 PARTNER → 两边都 200(防"后端整体坏了"被误判成通过)。

   做法:探针自己往 HSDZ_MES_TEST 插**纯 ASCII** 的标记面板行与标记译名(用完即删),
        不依赖既有数据不对称 —— 因此测试库被重建后本探针依然有效。
   前置:本机 Windows 账号需是 SQL sysadmin(集成认证);否则设 YINJIA_SQL_PASS 走 -U yinjia。 */
const { spawnSync } = require('node:child_process')

const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
const MARK = 'ZZ_LEDGER_PROBE'
const MARK_TXT = 'ZZ-TEST-ONLY-TRANSLATION'
const PARTNER = '往来单位' // PARTNER 面板的中文名,译名以它做 ref_key

const sql = (text, db) => {
  const common = ['-S', 'localhost', '-I', '-d', db, '-f', '65001', '-h', '-1', '-W', '-Q', `SET NOCOUNT ON; ${text}`]
  const env = { ...process.env }
  const args = process.env.YINJIA_SQL_PASS
    ? [...common, '-U', 'yinjia', '-P', process.env.YINJIA_SQL_PASS]
    : [...common, '-E']
  const r = spawnSync('sqlcmd', args, { encoding: 'utf8', env })
  if (r.status === 0) return r.stdout
  throw new Error(`sqlcmd 失败: ${(r.stderr || r.stdout || '').trim()}\n` +
    '提示:本机账号需为 SQL sysadmin,或设置 YINJIA_SQL_PASS 后重跑')
}

async function api(path, { method = 'GET', token, body, lang } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = 'Bearer ' + token
  if (lang) headers['Accept-Language'] = lang
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  let json = null
  try { json = await res.json() } catch { /* 忽略 */ }
  return { http: res.status, json }
}
const login = async (factory) => {
  const r = await api('/api/auth/login', { method: 'POST', body: { userName: 'admin', password: '123456', factory } })
  if (!r.json?.data?.token) throw new Error(`登录失败(${factory}): ${JSON.stringify(r.json)?.slice(0, 200)}`)
  return r.json.data.token
}
/** 返回 {code, name}:面板配置是否可用 + 该账套看到的（可能已翻译的）面板名 */
const panelOf = async (token, code, lang) => {
  const r = await api(`/api/px/getPanelConfig?panelCode=${code}`, { token, lang })
  return { code: r.json?.code, name: r.json?.data?.metadata?.panelName }
}

async function main() {
  const fails = []
  const want = (cond, msg) => { if (!cond) fails.push(msg); console.log(`  ${cond ? '✓' : '✗'} ${msg}`) }

  console.log(`[0] 在 HSDZ_MES_TEST 装标记数据(面板 ${MARK} + 译名 "${MARK_TXT}") ...`)
  sql(`DELETE FROM yj_panel WHERE panel_code='${MARK}';
       INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, pk_col)
       SELECT '${MARK}', 'Ledger Probe', 'Probe', 'archive', 'yj_share_file', 'id'
       WHERE NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='${MARK}');`,
    'HSDZ_MES_TEST')
  // 译名:测试库**本来就有** (panel,往来单位,en),所以不能只"缺则插"——
  // 先记下原值,再覆盖成标记文本,收尾还原(否则等于没造出不对称,断言永远失败)。
  const origTxt = sql(`SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'${PARTNER}' AND locale='en';`, 'HSDZ_MES_TEST').trim()
  sql(`DELETE FROM yj_translation WHERE scope='panel' AND ref_key=N'${PARTNER}' AND locale='en';
       INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'${PARTNER}', 'en', '${MARK_TXT}', 'manual');`,
    'HSDZ_MES_TEST')
  const nowTxt = sql(`SELECT text FROM yj_translation WHERE scope='panel' AND ref_key=N'${PARTNER}' AND locale='en';`, 'HSDZ_MES_TEST').trim()
  if (nowTxt !== MARK_TXT) throw new Error(`标记译名写入失败(现值=${nowTxt})`)
  console.log(`    原译名=${JSON.stringify(origTxt || '(无)')} → 已覆盖为 ${JSON.stringify(MARK_TXT)}(收尾会还原)`)

  try {
    const yj = await login('YJ')
    const yjt = await login('YJ_TEST')

    console.log('[1] 面板元数据:测试库独有的标记面板(每轮先正式后测试)')
    for (let i = 1; i <= 3; i++) {
      const a = await panelOf(yj, MARK)
      const b = await panelOf(yjt, MARK)
      console.log(`    第${i}轮  YJ=${a.code}  YJ_TEST=${b.code}`)
      want(a.code !== 200, `第${i}轮 YJ 不应看到测试库独有的面板(缓存串库了)`)
      want(b.code === 200, `第${i}轮 YJ_TEST 必须看到自己库里的面板`)
    }

    console.log('[2] 译名:测试库独有的面板名译名(Accept-Language: en)')
    for (let i = 1; i <= 3; i++) {
      const a = await panelOf(yj, 'PARTNER', 'en')
      const b = await panelOf(yjt, 'PARTNER', 'en')
      console.log(`    第${i}轮  YJ=${JSON.stringify(a.name)}  YJ_TEST=${JSON.stringify(b.name)}`)
      want(a.name !== MARK_TXT, `第${i}轮 YJ 不应出现测试库独有的译名(译名缓存串库了)`)
      want(b.name === MARK_TXT, `第${i}轮 YJ_TEST 必须用自己库的译名`)
    }

    console.log('[3] 负向对照(两账套都有的 PARTNER,两边都应 200):')
    want((await panelOf(yj, 'PARTNER')).code === 200, 'YJ 能取到 PARTNER 配置')
    want((await panelOf(yjt, 'PARTNER')).code === 200, 'YJ_TEST 能取到 PARTNER 配置')
  } finally {
    sql(`DELETE FROM yj_panel WHERE panel_code='${MARK}';
         DELETE FROM yj_translation WHERE scope='panel' AND ref_key=N'${PARTNER}' AND locale='en';
         ${origTxt
        ? `INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'${PARTNER}', 'en', N'${origTxt.replace(/'/g, "''")}', 'manual');`
        : ''}`, 'HSDZ_MES_TEST')
    console.log('[清理] 已删除标记面板、并还原原译名')
  }

  if (fails.length) {
    console.error(`\nFAIL(${fails.length} 项):缓存未按账套隔离 —— 详见技术债 #11`)
    fails.forEach((f) => console.error('  - ' + f))
    process.exit(1)
  }
  console.log('\nPASS:面板元数据与译名缓存均已按账套隔离')
}

main().catch((e) => { console.error('探针异常:', e.message); process.exit(2) })
