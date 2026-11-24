/**
 * 纸面手动缩放（2026-11-24 用户报障）。
 *
 * 用户原话：「有一个用户反馈说他的这个面板看起来有点小，其他人都没有就他有这种情况，也调不大」。
 * 根因：DocSheet 按「可用宽 ÷ 纸宽」自动等比缩小（RD_APPROVAL 纸宽 1242、下限 0.6、上限 1），
 * 窗口窄的用户纸面被缩到 0.7 左右且**没有手动放大入口**（大屏用户顶到 1 就正常）。
 * 用户选定方案：加纸面手动缩放（适应宽度 / 缩小 / 放大，最大 150%，记住选择）。
 *
 * 本文件钉住三件事：
 * ① 纯函数口径（fit 的下限/上限、手动值的钳位与步进、存储往返与坏数据兜底）；
 * ② DocSheet 真的把「用户缩放」接进了 sheetStyle（否则点了按钮纸面不动）；
 * ③ PanelxList 真的渲染了缩放条（否则用户根本看不到入口）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  MIN_SHEET_ZOOM, MAX_SHEET_ZOOM, ZOOM_STEP,
  fitZoom, clampZoom, stepZoom, resolveZoom,
  zoomStoreKey, loadStoredZoom, saveStoredZoom, clearStoredZoom,
} from './sheetZoom.js'

const mem = () => {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  }
}

test('适应宽度：可用宽 ÷ 纸宽，封顶 1、封底 0.6', () => {
  // 实测两个真实档位：1920 窗口可用 1514、1273 窗口可用 867（纸宽 1242）
  assert.equal(fitZoom(1514, 1242), 1, '装得下时不许放大，保持设计字号')
  assert.equal(Math.round(fitZoom(867, 1242) * 1000) / 1000, 0.685, '1273 窗口实测缩到 0.685')
  assert.equal(fitZoom(700, 1242), MIN_SHEET_ZOOM, '再窄也不低于 0.6，剩下交给横向滚动')
  assert.equal(fitZoom(900, 0), 1, '无定宽纸（paperW=0）不缩放')
})

test('手动缩放钳位在 0.6 ~ 1.5，两位小数', () => {
  assert.equal(MAX_SHEET_ZOOM, 1.5, '用户口径：最大 150%')
  assert.equal(clampZoom(1.9), 1.5)
  assert.equal(clampZoom(0.1), MIN_SHEET_ZOOM)
  assert.equal(clampZoom(1.234), 1.23)
  assert.equal(clampZoom('1.1'), 1.1, '存储读回的是字符串也要能用')
  assert.equal(clampZoom('abc'), null, '坏值一律当没设置')
})

test('步进：每次 10%，到头不越界', () => {
  assert.equal(ZOOM_STEP, 0.1)
  assert.equal(stepZoom(1, 1), 1.1)
  assert.equal(stepZoom(1.1, -1), 1)
  assert.equal(stepZoom(1.5, 1), 1.5)
  assert.equal(stepZoom(0.6, -1), 0.6)
  assert.equal(stepZoom(null, 1), null, '没设过手动值时不从 0 起步')
})

test('生效缩放：用户设置优先，否则走适应宽度', () => {
  assert.equal(resolveZoom(null, 0.685), 0.685, '适应宽度模式')
  assert.equal(resolveZoom(1.2, 0.685), 1.2, '手动值优先，且不受 1 封顶限制')
  assert.equal(resolveZoom(2, 0.685), 1.5, '手动值也要钳位')
})

test('按面板记住选择：存、读、清，坏数据不抛错', () => {
  const s = mem()
  assert.equal(zoomStoreKey('RD_APPROVAL'), 'mes_sheet_zoom_RD_APPROVAL', '按面板分开记')
  assert.equal(loadStoredZoom('RD_APPROVAL', s), null, '没存过 = 适应宽度')
  assert.equal(saveStoredZoom('RD_APPROVAL', 1.2, s), 1.2)
  assert.equal(loadStoredZoom('RD_APPROVAL', s), 1.2)
  assert.equal(loadStoredZoom('RD_PLAN', s), null, '不同面板互不影响')
  s.setItem('mes_sheet_zoom_RD_APPROVAL', '{oops')
  assert.equal(loadStoredZoom('RD_APPROVAL', s), null, '坏 JSON 当没设置')
  clearStoredZoom('RD_APPROVAL', s)
  assert.equal(loadStoredZoom('RD_APPROVAL', s), null)
  // storage 不可用（隐私模式/禁用）时不能抛
  assert.equal(loadStoredZoom('X', null), null)
  assert.equal(saveStoredZoom('X', 1.1, null), null)
})

test('接线：DocSheet 把用户缩放接进纸面样式，PanelxList 渲染缩放条', () => {
  const docSheet = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')
  const list = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')
  assert.match(docSheet, /userZoom:\s*\{\s*type:\s*Number/, 'DocSheet 要有 userZoom 入参')
  assert.match(docSheet, /resolveZoom\(props\.userZoom/, 'sheetStyle 的 zoom 要经 resolveZoom')
  assert.match(list, /sheet-zoom-bar/, 'PanelxList 要有缩放条容器')
  assert.match(list, /:user-zoom="sheetZoomUser"/, '缩放条的状态要传给 DocSheet')
})
