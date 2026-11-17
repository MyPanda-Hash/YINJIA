/**
 * pickRowStyle.test.js —— 「未勾选的明细行置灰 + 不能填写」的回归闸(2026-11-17 客户反馈)
 *
 * 客户原话:「没有勾选的单据明细没有做区分,还是可填。」
 *   修改方案:「没有勾选为灰色而且不能有输入。所有打印和生单都要有。关于明细勾选的」
 *
 * 本测试守四件事(漏任何一件,客户下次看到的还是同一个毛病):
 *   ① 纯函数口径:勾选集合归一(Set / 行键数组 / el-table 的 selection 行对象)、
 *      未勾选 ⇒ 灰类、已勾选 ⇒ 空类、未勾选 ⇒ 锁;
 *   ② **四个打印/生单弹窗都接上了**:分批送料、统一生单/合单生单、打印材料码、打印采购订单 ——
 *      每张"能勾明细"的表都要打灰类,表里每个能填的控件都要吃 pickRowLocked;
 *   ③ 灰类样式真的在全局样式表里(行是 el-table 内部渲染的 <tr>,组件 scoped 样式够不着);
 *   ④ 新加的那句提示文案在各语言包里都有译名(切 en/ja 不露中文)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  UNPICKED_ROW_CLASS, isPicked, pickRowClass, pickRowLocked, pickedKeySet,
} from './pickRowStyle.js'

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')
const src = (rel) => read(new URL(rel, import.meta.url))

/** 四个"勾选明细 → 出单据/出纸"的弹窗(路径相对本文件) */
const DIALOGS = {
  '分批送料 BatchSendDialog': {
    file: './../views/BatchSendDialog.vue',
    // 两张表(原行 + 已打印隔离行)都要打灰类
    rowClassNames: ['rowClassRows', 'rowClassPrinted'],
    // 每张表 3 个可填控件:仓库 / 仓位 / 本次送料数量
    locks: 6,
  },
  '统一生单 GenerateLinesDialog': {
    file: './../views/GenerateLinesDialog.vue',
    rowClassNames: ['rowClassOfDoc'],
    // 仓库 / 仓位 / 本次数量
    locks: 3,
  },
  '打印材料码 MaterialLabelDialog': {
    file: './../views/MaterialLabelDialog.vue',
    rowClassNames: ['rowClassMain', 'rowClassSupp'],
    // 主表:本次打印数量 + 每箱数量;补登表:本次打印数量 + 每箱数量
    locks: 4,
  },
  '打印采购订单 PurchaseOrderPrintDialog': {
    file: './../views/PurchaseOrderPrintDialog.vue',
    rowClassNames: ['rowClassOf'],
    // 本次打印数量
    locks: 1,
  },
}

const countOf = (text, needle) => text.split(needle).length - 1

test('灰类名是常量,样式与代码共用同一个名字', () => {
  assert.equal(UNPICKED_ROW_CLASS, 'yj-pick-row-off')
})

test('① 勾选集合归一:Set / 行键数组 / selection 行对象都认,空值不炸', () => {
  assert.deepEqual([...pickedKeySet(new Set(['a', 'b']))], ['a', 'b'])
  assert.deepEqual([...pickedKeySet(['a', 1])], ['a', '1'])
  // el-table 的 selection 数组装的是**行对象**
  assert.deepEqual([...pickedKeySet([{ lineKey: 'PO#1' }, { lineKey: 'PO#2' }])], ['PO#1', 'PO#2'])
  // 自定义 keyOf(材料码弹窗按 id、采购订单打印按 __key)
  assert.deepEqual([...pickedKeySet([{ id: 7 }], (r) => r.id)], ['7'])
  assert.equal(pickedKeySet(null).size, 0)
  assert.equal(pickedKeySet(undefined).size, 0)
  assert.equal(pickedKeySet([null, undefined, '']).size, 0, '空行键不能进集合(否则会误判成"已勾")')
})

test('① 未勾选 ⇒ 灰类;已勾选 ⇒ 空类(不覆盖 element 自己的行类)', () => {
  const cls = pickRowClass(new Set(['A']))
  assert.equal(cls({ row: { lineKey: 'A' } }), '')
  assert.equal(cls({ row: { lineKey: 'B' } }), UNPICKED_ROW_CLASS)
  // 数字 id 与字符串 id 不分家(服务端 id 有时是数字)
  const byId = pickRowClass(new Set([1, 2]), (r) => r.id)
  assert.equal(byId({ row: { id: 1 } }), '')
  assert.equal(byId({ row: { id: '2' } }), '')
  assert.equal(byId({ row: { id: 3 } }), UNPICKED_ROW_CLASS)
  // 没有行键的行(理论上不该出现)也按未勾处理:宁可灰,不给"可填"的假象
  assert.equal(cls({ row: {} }), UNPICKED_ROW_CLASS)
})

test('① 输入框判据:未勾选一律锁,勾选才放开(Set 与数组两种入参同口径)', () => {
  const set = new Set(['A'])
  assert.equal(pickRowLocked(set, 'A'), false)
  assert.equal(pickRowLocked(set, 'B'), true)
  assert.equal(pickRowLocked(['A'], 'A'), false)
  assert.equal(pickRowLocked([{ lineKey: 'A' }], 'A'), false, '传 selection 行对象也认')
  assert.equal(pickRowLocked(new Set(), 'A'), true, '一行没勾 ⇒ 全锁')
  assert.equal(pickRowLocked(null, 'A'), true)
  assert.equal(pickRowLocked(set, ''), true, '空行键按未勾处理')
  assert.equal(isPicked(set, 'A'), true)
  assert.equal(isPicked([{ __key: 9 }], 9, (r) => r.__key), true, '自定义行键(采购订单打印的 __key)')
})

test('② 四个打印/生单弹窗都接上了「未勾选置灰 + 不可填」', () => {
  for (const [name, cfg] of Object.entries(DIALOGS)) {
    const text = src(cfg.file)
    assert.ok(text.includes('pickRowLocked'), `${name}: 表内控件没用 pickRowLocked 判禁用`)
    assert.ok(countOf(text, 'pickRowLocked(') >= cfg.locks,
      `${name}: 可填控件没全部吃上 pickRowLocked(至少 ${cfg.locks} 处)`)
    for (const fn of cfg.rowClassNames) {
      assert.ok(new RegExp(`\\b${fn}\\b`).test(text), `${name}: 缺 ${fn}(没给表格打灰类)`)
      // 两种合法绑法:直接绑函数(`:row-class-name="rowClassOf"`),或按来源单取函数(`…="rowClassOfDoc(doc)"`)
      assert.ok(new RegExp(`:row-class-name="${fn}\\(?`).test(text), `${name}: ${fn} 没绑到 row-class-name`)
    }
    assert.ok(/未勾选的明细行置灰、不能填写/.test(text), `${name}: 少了那句提示(用户要能看懂为什么填不了)`)
  }
})

test('② 每张「能勾明细」的表都绑了 row-class-name(新增表忘了接线会在这里失败)', () => {
  for (const [name, cfg] of Object.entries(DIALOGS)) {
    const text = src(cfg.file)
    // el-table / el-table-column 的 selection 列数(统一生单是自绘 el-checkbox,没有 selection 列)
    const selects = countOf(text, 'type="selection"')
    const classes = countOf(text, ':row-class-name=')
    const tables = selects === 0 ? 1 : selects
    assert.equal(classes, tables, `${name}: 有 ${tables} 张表可勾选,却只绑了 ${classes} 个 row-class-name`)
  }
})

test('③ 灰类样式在全局样式表里(组件 scoped 打不到 el-table 的 <tr>)', () => {
  const css = src('../../styles/index.css')
  assert.ok(css.includes('.yj-pick-row-off'), 'styles/index.css 缺灰行样式')
  assert.ok(/\.yj-pick-row-off[^{]*> td\.el-table__cell/.test(css), '灰底要打在单元格上(行背景会被单元格盖住)')
  assert.ok(/\.yj-pick-row-off:hover/.test(css), 'hover 也要保持"没勾"的观感')
  // 组件里不许各写一份(那样下次又会漏一处)
  for (const [name, cfg] of Object.entries(DIALOGS)) {
    assert.ok(!/\.yj-pick-row-off/.test(src(cfg.file)), `${name}: 不要在组件 scoped 里另写一份灰行样式`)
  }
})

test('④ 提示文案在各语言包都有译名(切 en / ja 不露中文)', () => {
  const key = '未勾选的明细行置灰、不能填写'
  const locales = ['en', 'zh-TW', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'vi', 'th']
  for (const l of locales) {
    const text = src(`../../i18n/locales/${l}.js`)
    const hit = new RegExp(`'${key}':\\s*'([^']+)'`).exec(text)
    assert.ok(hit, `${l}.js 缺这条词条`)
    assert.notEqual(hit[1].trim(), key, `${l}.js 的译名还是中文原文`)
  }
})
