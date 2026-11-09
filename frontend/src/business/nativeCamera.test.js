/**
 * nativeCamera.test.js — 安卓壳「原生拍照」桥的纯逻辑单测(2026-11-09 第四轮)
 *
 * 钉住三件事:
 *   ① 桥的探测口径(只有壳注入了 `YjNative.takePhoto` 才算原生可用,否则网页照旧用 <input type=file>);
 *   ② dataURL 解析:base64 与非 base64、坏数据都要有确定结果(不能"看起来成功其实传了个空文件");
 *   ③ 相机返回的 dataURL 能变成可上传的 File/Blob(名字与 mime 不能丢,否则后端 attachment 存成无扩展名)。
 *
 * 运行:`cd frontend && npm test`(node --test)
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { hasNativeCamera, parseDataUrl, dataUrlToFile } from './nativeCamera.js'

/** 造一个最小 JPEG 的 base64(内容无所谓,只验证搬运) */
const B64 = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]).toString('base64')

// ── ① 探测 ───────────────────────────────────────────────────────────────

test('hasNativeCamera:没有 window/YjNative 时一律 false(网页版走 file input)', () => {
  const saved = globalThis.window
  try {
    delete globalThis.window
    assert.equal(hasNativeCamera(), false)
    globalThis.window = {}
    assert.equal(hasNativeCamera(), false)
    globalThis.window = { YjNative: {} }
    assert.equal(hasNativeCamera(), false, '只有 getBaseUrl 不算能拍照')
    globalThis.window = { YjNative: { takePhoto: () => {} } }
    assert.equal(hasNativeCamera(), true)
  } finally {
    if (saved === undefined) delete globalThis.window
    else globalThis.window = saved
  }
})

// ── ② dataURL 解析 ───────────────────────────────────────────────────────

test('parseDataUrl:jpeg base64 正常解析出 mime 与字节串', () => {
  const p = parseDataUrl(`data:image/jpeg;base64,${B64}`)
  assert.equal(p.mime, 'image/jpeg')
  assert.equal(p.base64, true)
  assert.equal(p.data, B64)
});

test('parseDataUrl:非 dataURL / 空值 → null(不猜)', () => {
  assert.equal(parseDataUrl(''), null)
  assert.equal(parseDataUrl(null), null)
  assert.equal(parseDataUrl('http://x/a.jpg'), null)
});

test('parseDataUrl:非 base64 的 data URL 也要认出来(base64 标记为 false)', () => {
  const p = parseDataUrl('data:text/plain,hello')
  assert.equal(p.mime, 'text/plain')
  assert.equal(p.base64, false)
  assert.equal(p.data, 'hello')
});

// ── ③ dataURL → File ────────────────────────────────────────────────────

test('dataUrlToFile:字节、文件名、mime 三样都不能丢', () => {
  const f = dataUrlToFile(`data:image/jpeg;base64,${B64}`, 'yj_photo_1.jpg')
  assert.equal(f.name, 'yj_photo_1.jpg')
  assert.equal(f.type, 'image/jpeg')
  assert.equal(f.size, 6)
});

test('dataUrlToFile:没给文件名时用 photo.jpg(后端按扩展名判图片)', () => {
  const f = dataUrlToFile(`data:image/jpeg;base64,${B64}`)
  assert.equal(f.name, 'photo.jpg')
});

test('dataUrlToFile:坏数据直接抛错(不能悄悄传空文件)', () => {
  assert.throws(() => dataUrlToFile('', 'a.jpg'))
  assert.throws(() => dataUrlToFile('data:text/plain,hello', 'a.txt'), /照片数据无效/)
});
