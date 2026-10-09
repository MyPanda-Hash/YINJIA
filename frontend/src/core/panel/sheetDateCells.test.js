/**
 * sheetDateCells.test.js — 实验室记录表「日期/时间格」取值的纯函数固件(2026-10-07)
 *
 * 为什么单独一个文件:这些格子的历史值是**从 Excel 抄过来的自由文本**,
 * 写法五花八门(见下面 REAL_VALUES 的真样本),而控件要的是
 * `YYYY-MM-DD` / `HH:mm` 这类规范串。归一规则必须能脱离浏览器断言:
 *   ① 归一失败**不能丢数据**(返回空串只是"控件显示不出来",原值仍回传库);
 *   ② 归一规则要覆盖真实历史写法,而不是照着理想格式写。
 *
 * 真样本来源(只读取证,未改库):
 *   · 服务器接口 GET/POST /api/px/queryFormDataList(RD_* 实测,2026-10-07)
 *   · 本地 HSDZ_MES:rd_antibact_head.测试时间='2025.9.19-9.20'、
 *     rd_soak_head.测试时间='2026.3.1-3.2'、rd_spike_water_detail.测试日期='2026.09.04'、
 *     rd_instr_use_detail.起止时间='09:00-10:00' / '15.00-16.00'
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  cellKindOf,
  toDateText,
  toTimeText,
  toDateTimeText,
  parseTimeRange,
  joinTimeRange,
  cellText,
  controlValue,
  controlToStored,
} from './sheetDateCells.js'

// ── 控件类型:按 yj_field.data_type 决定(与通用面板 isDateField 同一份中文词表) ──
test('cellKindOf:日期类类型 → 控件种类,其余一律 text', () => {
  assert.equal(cellKindOf('日期'), 'date')
  assert.equal(cellKindOf('日期时间'), 'datetime')
  assert.equal(cellKindOf('时间'), 'time')
  assert.equal(cellKindOf('时间区间'), 'time-range')
  assert.equal(cellKindOf('文本'), 'text')
  assert.equal(cellKindOf('下拉框'), 'text')
  assert.equal(cellKindOf(''), 'text')
  assert.equal(cellKindOf(null), 'text')
  assert.equal(cellKindOf(undefined), 'text')
})

// ── 日期归一:服务器 datetime 列下发的是带时区偏移的 ISO 串,本地库是各种自由文本 ──
test('toDateText:真实历史写法都能认出日期', () => {
  // 服务器 datetime 列经 Jackson 下发(带 +00:00);不归一的话回传即 241 报错
  assert.equal(toDateText('2026-10-06T16:00:00.000+00:00'), '2026-10-06')
  assert.equal(toDateText('2026-09-27T08:23:42.000+00:00'), '2026-09-27')
  assert.equal(toDateText('2026-09-27T16:23:42.000+08:00'), '2026-09-27')
  // 本地库里的自由文本(点/斜杠/中文年月日/无补零)
  assert.equal(toDateText('2026.09.04'), '2026-09-04')
  assert.equal(toDateText('2026/10/7'), '2026-10-07')
  assert.equal(toDateText('2026/9/27 15:54:39'), '2026-09-27')
  assert.equal(toDateText('2026-9-4'), '2026-09-04')
  assert.equal(toDateText('2026年10月7日'), '2026-10-07')
  assert.equal(toDateText(' 2026-10-07 '), '2026-10-07')
  // 日期段只取段首(段尾属于区间控件的活)
  assert.equal(toDateText('2025.9.19-9.20'), '2025-09-19')
  // Excel 序列(压降精度表历史值 '45926');实测 1900 序列 45926 = 2025-09-26
  assert.equal(toDateText('45926'), '2025-09-26')
  assert.equal(toDateText(45926), '2025-09-26')
  // 认不出来就返回空串(不猜、不丢原值)
  assert.equal(toDateText(''), '')
  assert.equal(toDateText(null), '')
  assert.equal(toDateText('待定'), '')
  assert.equal(toDateText('260927'), '')
})

test('toDateText:非法月日不产出假日期', () => {
  assert.equal(toDateText('2026-13-01'), '')
  assert.equal(toDateText('2026-02-30'), '')
  assert.equal(toDateText('2025-02-29'), '')
  assert.equal(toDateText('2024-02-29'), '2024-02-29') // 闰年照收
})

// ── 时间:单值与区间 ──
test('toTimeText:HH:mm 归一(含历史点号写法与带秒)', () => {
  assert.equal(toTimeText('09:00'), '09:00')
  assert.equal(toTimeText('9:5'), '09:05')
  assert.equal(toTimeText('09:00:00'), '09:00')
  assert.equal(toTimeText('15.00'), '15:00')
  assert.equal(toTimeText('2026-09-27T08:23:42.000+00:00'), '08:23')
  assert.equal(toTimeText('abc'), '')
  assert.equal(toTimeText(''), '')
})

test('toDateTimeText:日期+时间(用于"日期时间"类字段)', () => {
  assert.equal(toDateTimeText('2026-10-06T16:00:00.000+00:00'), '2026-10-06 16:00:00')
  assert.equal(toDateTimeText('2026/9/27 15:54:39'), '2026-09-27 15:54:39')
  assert.equal(toDateTimeText('2026.09.04'), '2026-09-04 00:00:00')
  assert.equal(toDateTimeText('待定'), '')
})

test('parseTimeRange:起止时间历史值 → [开始,结束]', () => {
  assert.deepEqual(parseTimeRange('09:00-10:00'), ['09:00', '10:00'])
  assert.deepEqual(parseTimeRange('15.00-16.00'), ['15:00', '16:00'])
  assert.deepEqual(parseTimeRange('09:00~10:00'), ['09:00', '10:00'])
  assert.deepEqual(parseTimeRange('09:00—10:00'), ['09:00', '10:00'])
  assert.deepEqual(parseTimeRange('09:00 - 10:00'), ['09:00', '10:00'])
  // 认不出来 → null(控件空着,不写回,原值不丢)
  assert.equal(parseTimeRange('333'), null)
  assert.equal(parseTimeRange(''), null)
  assert.equal(parseTimeRange(null), null)
})

test('joinTimeRange:控件回值 → 落库文本', () => {
  assert.equal(joinTimeRange(['09:00', '10:00']), '09:00-10:00')
  assert.equal(joinTimeRange(['9:0', '10:0']), '09:00-10:00')
  assert.equal(joinTimeRange(['09:00']), '')
  assert.equal(joinTimeRange(null), '')
  assert.equal(joinTimeRange(['09:00', '']), '')
})

test('cellText:只读格显示按种类归一,认不出来原样显示', () => {
  assert.equal(cellText('date', '2026-10-06T16:00:00.000+00:00'), '2026-10-06')
  assert.equal(cellText('date', '2026.09.04'), '2026-09-04')
  assert.equal(cellText('date', '待定'), '待定')          // 非日期文本原样保留,不显示成空白
  assert.equal(cellText('date', ''), '')
  assert.equal(cellText('time-range', '09:00-10:00'), '09:00-10:00')
  assert.equal(cellText('time-range', '15.00-16.00'), '15:00-16:00')
  assert.equal(cellText('time-range', '333'), '333')
  assert.equal(cellText('text', '2026-10-06T16:00:00.000+00:00'), '2026-10-06T16:00:00.000+00:00')
  assert.equal(cellText('datetime', '2026-10-06T16:00:00.000+00:00'), '2026-10-06 16:00:00')
})

// ── 控件绑定:进控件的值(归一)/出控件的值(落库) ──
test('controlValue:库里值 → 控件绑定值;认不出来给空/null 且不回写', () => {
  assert.equal(controlValue('date', '2026-10-06T16:00:00.000+00:00'), '2026-10-06')
  assert.equal(controlValue('date', '2026.09.04'), '2026-09-04')
  assert.equal(controlValue('date', '待定'), '')      // 归不出来 → 控件空着,原值仍在 row 里
  assert.equal(controlValue('date', ''), '')
  assert.deepEqual(controlValue('time-range', '09:00-10:00'), ['09:00', '10:00'])
  assert.deepEqual(controlValue('time-range', '15.00-16.00'), ['15:00', '16:00'])
  assert.equal(controlValue('time-range', '333'), null)
  assert.equal(controlValue('time', '09:00:00'), '09:00')
  assert.equal(controlValue('datetime', '2026-10-06T16:00:00.000+00:00'), '2026-10-06 16:00:00')
  assert.equal(controlValue('text', '随便'), '随便')
})

test('controlToStored:控件回值 → 落库文本(清空给空串,区间不完整不落)', () => {
  assert.equal(controlToStored('date', '2026-10-07'), '2026-10-07')
  assert.equal(controlToStored('date', null), '')
  assert.equal(controlToStored('datetime', '2026-10-07 08:30:00'), '2026-10-07 08:30:00')
  assert.equal(controlToStored('time', '08:30'), '08:30')
  assert.equal(controlToStored('time-range', ['09:00', '10:00']), '09:00-10:00')
  assert.equal(controlToStored('time-range', null), '')
  assert.equal(controlToStored('time-range', ['09:00']), '')
})
