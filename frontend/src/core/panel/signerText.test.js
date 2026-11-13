/**
 * signerText.test.js — 会签人 账号⇄姓名 纯函数
 * 口径见 signerText.js 头注；切分集合必须与 ButtonService.signersOf 逐字一致。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { splitSigners, joinSigners, signerNames } from './signerText.js'

const BTN = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')
const USERS = [
  { username: 'sampler', realName: '打样员' },
  { username: 'cp', realName: '陈秀丽' },
]

test('① 切分口径与后端 signersOf 一致（后端改了分隔符这里必须跟着发现）', () => {
  // 后端原文：raw.split("[,，、;；\\s]+")
  assert.match(BTN, /split\("\[,，、;；\\\\s\]\+"\)/, '后端 signersOf 的切分正则变了，前端 signerText 必须同步')
  // 每种分隔符都要能切开
  for (const sep of [',', '，', '、', ';', '；', ' ', '\n']) {
    assert.deepEqual(splitSigners(`a${sep}b`), ['a', 'b'], `分隔符 ${JSON.stringify(sep)} 未切开`)
  }
})

test('② 去空 + 去重保序（重复勾选同一人不该出现两次会签行）', () => {
  assert.deepEqual(splitSigners('a、a、 b 、、a'), ['a', 'b'])
  assert.deepEqual(splitSigners(''), [])
  assert.deepEqual(splitSigners(null), [])
  assert.deepEqual(splitSigners(undefined), [])
})

test('③ 写回用顿号分隔（后端与既有单据都认）', () => {
  assert.equal(joinSigners(['a', 'b']), 'a、b')
  assert.equal(joinSigners([]), '')
  assert.equal(joinSigners([' a ', '', 'b']), 'a、b')
  assert.equal(joinSigners(null), '')
})

test('④ 账号 → 姓名（这是用户要看到的）', () => {
  assert.equal(signerNames('sampler、cp', USERS), '打样员、陈秀丽')
})

test('⑤ 查不到的账号回落显示账号本身（停用/删号后老单据仍能看出是谁）', () => {
  assert.equal(signerNames('sampler、ghost', USERS), '打样员、ghost')
})

test('⑥ 空值不炸、不产生多余顿号', () => {
  assert.equal(signerNames('', USERS), '')
  assert.equal(signerNames(null, USERS), '')
  assert.equal(signerNames('sampler', []), 'sampler')
  assert.equal(signerNames('sampler', null), 'sampler')
})

test('⑦ 往返：split → join 不改变内容（除分隔符归一化）', () => {
  assert.equal(joinSigners(splitSigners('cp,sampler;cp')), 'cp、sampler')
})
