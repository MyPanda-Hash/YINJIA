/**
 * 外部开发样品单编号规则（2026-11-18 用户口径，Excel #7）：
 *   「编号规则按照 建表用户名称小写 + 年 + 月 + 日 + 序号」
 *   例：liulei-2026-11-18-01 / xieqin-2026-11-18-01
 *
 * 只在**这张单**生效（RD_SAMPLE_EXT）；内部开发/非开发样品单仍用全局 `前缀-年月-四位`。
 * 后端没有单测基建，这里用源码断言把契约钉住（同 datarecAuditor.test.js 的做法）：
 *   · 面板白名单只有 RD_SAMPLE_EXT，多一个就会悄悄改掉别的单的编号规则；
 *   · 新建的两个取号点都必须走 nextDocNoFor（漏一处就会出现"新增出来的号还是 SPW-"）；
 *   · 序号两位补零、号池按「lb=前缀 / ny=当天」留痕（与历史 yyyy-MM 行隔离）；
 *   · 新建表单的预览必须同源（否则表单先显示 SPW-…、点新增变 liulei-…）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const btn = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')
const no = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/FormNoService.java', import.meta.url), 'utf8')
const facade = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/PanelFacade.java', import.meta.url), 'utf8')

test('白名单只有外部开发样品单（RD_SAMPLE_EXT）', () => {
  const m = btn.match(/USER_DAY_SEQ_PANELS\s*=\s*java\.util\.Set\.of\(([^)]*)\)/)
  assert.ok(m, '缺 USER_DAY_SEQ_PANELS 常量')
  const codes = [...m[1].matchAll(/"([A-Z0-9_]+)"/g)].map((x) => x[1])
  assert.deepEqual(codes, ['RD_SAMPLE_EXT'], '只能登记 RD_SAMPLE_EXT 一张单')
})

test('新建取号两处都走 nextDocNoFor（漏一处就会出现旧格式号）', () => {
  const direct = (btn.match(/no = nextDocNoFor\(def, user\);/g) || []).length
  assert.ok(direct >= 2, `新建取号点应≥2 处，实测 ${direct}`)
  assert.doesNotMatch(btn, /no = formNoService\.next\(def\.prefix\(\), user\);/, '不得再有裸调 formNoService.next 的新建取号')
})

test('取号格式 = 账号小写-yyyy-MM-dd-两位序号，号池按天留痕', () => {
  assert.match(no, /private static final DateTimeFormatter DAY_FMT = DateTimeFormatter\.ofPattern\("yyyy-MM-dd"\)/)
  assert.match(no, /String base = owner \+ "-" \+ day \+ "-";/, '前缀段 = 账号-日期-')
  assert.match(no, /String\.format\("%02d", seq\+\+\)/, '序号两位补零')
  assert.match(no, /\.toLowerCase\(Locale\.ROOT\)/, '账号小写')
  // 号池 ny 存当天日期段 ⇒ 与历史 yyyy-MM 行天然隔离
  assert.match(no, /INSERT INTO s_allno \(comm, dh, lb, ny, asp_user1, asp_time1, asp_cancel\)[\s\S]{0,120}"0", no, prefix, day, owner\)/)
})

test('取号基准与占用判重沿用既有机制（防 2026-10-19 重号事故复发）', () => {
  const at = no.indexOf('private String nextFreeUserDay')
  const seg = no.slice(at, at + 700)
  assert.match(seg, /maxPoolUserDaySeq/, '要参考号池末号')
  assert.match(seg, /maxDocUserDaySeq/, '要参考业务表最大号')
  assert.match(seg, /taken\(no, prefix\)/, '逐号判重必须复用 taken()')
})

test('新建表单预览同源（否则表单显示 SPW-、新增后变成账号日期号）', () => {
  assert.match(facade, /buttonService\.previewDocNo\(def\)/, 'PanelFacade 预览要走 previewDocNo')
  assert.match(btn, /public String previewDocNo\(PanelRegistry\.PanelDef def\)/, '缺 previewDocNo')
  assert.match(btn, /formNoService\.previewUserDay\(def\.prefix\(\), user\)/, '预览也要按新规则')
})
