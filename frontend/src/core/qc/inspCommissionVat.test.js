/**
 * inspCommissionVat.test.js —— 检验委托单「总金额（含增值税6%）RMB」回归
 *
 * 2026-11-16 用户口径:
 *   ①「修改文件的总金额计算方式,将合计收费修改为（总金额（含增值税6%）RMB）」;
 *   ②「之后的总金额需要在原基础上增加6%的数值」。
 * ⇒ 纸面标签改为「总金额（含增值税6%）RMB」,金额 = 行表「收费」合计 × (1+6%),
 *    体现为 600 → 636.00(截图里 6 行 ×100 的合计)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { VAT_RATE, withVat, vatTotalText } from './inspCommissionVat.js'

const sheet = readFileSync(new URL('./InspCommissionSheet.vue', import.meta.url), 'utf8')
const en = readFileSync(new URL('../../i18n/locales/en.js', import.meta.url), 'utf8')

test('税率 = 6%', () => {
  assert.equal(VAT_RATE, 0.06)
})

test('金额按「原基础上加 6%」算,并按分四舍五入(两位小数)', () => {
  // 用户截图:6 个检验项 × 收费 100 = 600 净额 → 总金额 636.00
  assert.equal(withVat(600), 636)
  assert.equal(vatTotalText(600), '636.00')
  // 单行
  assert.equal(vatTotalText(100), '106.00')
  // 四舍五入边界:123.45 × 1.06 = 130.857 → 130.86
  assert.equal(withVat(123.45), 130.86)
  assert.equal(vatTotalText(123.45), '130.86')
  // 小金额:0.05 × 1.06 = 0.053 → 0.05(按分)
  assert.equal(vatTotalText(0.05), '0.05')
  // 空/脏值按 0,不给纸面 NaN
  assert.equal(vatTotalText(0), '0.00')
  assert.equal(vatTotalText(''), '0.00')
  assert.equal(vatTotalText(null), '0.00')
  assert.equal(vatTotalText('abc'), '0.00')
})

test('纸面标签:合计收费 → 总金额（含增值税6%）RMB', () => {
  assert.match(sheet, /tt\('总金额（含增值税6%）RMB：'\)/, '纸面要显示新的总金额标签')
  assert.doesNotMatch(sheet, /tt\('合计收费：'\)/, '旧的「合计收费：」标签不能再出现在纸面上')
  // 英文界面同一条词条
  assert.match(en, /"总金额（含增值税6%）RMB："\s*:\s*"Total Amount \(incl\. 6% VAT\) RMB:"/)
})

test('显示值与回写表头都走含税口径(同一处换算,不各写一份)', () => {
  // 显示:computed 里走 vatTotalTextOf
  assert.match(sheet, /const feeTotalText = computed\(\(\) => \{[\s\S]{0,120}vatTotalTextOf\(items\.value\)/)
  // 回写表头:带入/删行后重算时写含税总金额
  assert.match(sheet, /props\.head\['合计收费'\] = vatTotalTextOf\(arr\)/)
  // 打开已保存单据时静默按现行口径重算表头(旧单里可能是净额)
  assert.match(sheet, /props\.head\['合计收费'\] = next/, '打开单据要按含税口径同步表头')
  // 换算只有一处实现(inspCommissionVat.js),组件里不许再写一遍 1.06
  assert.match(sheet, /import \{ vatTotalText \} from '\.\/inspCommissionVat'/)
})
