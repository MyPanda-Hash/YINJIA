// gen-locales-gap.cjs — 按缺口自动补齐语言包(以 en.js 为基准,阿里云机翻)
// 用法: node gen-locales-gap.cjs [locale...]      (默认全部非中文语言包)
// 依赖: 后端运行 + ALIBABA_CLOUD_ACCESS_KEY_* 已配置(机翻可用)
// 幂等: 已有词条跳过,不覆盖人工翻译;可重复执行
// 取键方式: 直接 import 语言包模块(权威,能正确处理含换行/引号的键)
const fs = require('fs')
const path = require('path')

const BASE = 'http://localhost:8090'
const DIR = path.join(__dirname, '..', 'frontend', 'src', 'i18n', 'locales')
const DEFAULT_LOCALES = ['ja', 'ko', 'es', 'fr', 'de', 'ru', 'vi', 'th', 'zh-TW']
const CHUNK = 50

async function loadBiz(locale) {
  const file = path.join(DIR, `${locale}.js`).replace(/\\/g, '/')
  const mod = await import('file:///' + file)
  return (mod.default && mod.default.biz) || {}
}

function escKey(k) {
  return k.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n')
}

function escVal(v) {
  return String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n').trim()
}

async function translateBatch(locale, keys) {
  const res = await fetch(`${BASE}/api/locale/dict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ locale, keys }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = await res.json()
  return (j && j.data && j.data.dict) || {}
}

async function main() {
  const targets = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_LOCALES
  const enBiz = await loadBiz('en')
  const enKeys = Object.keys(enBiz)
  console.log(`en.biz 基准键数: ${enKeys.length}\n`)

  let totalWritten = 0
  for (const locale of targets) {
    const full = path.join(DIR, `${locale}.js`)
    if (!fs.existsSync(full)) { console.log(`${locale}: 语言包不存在,跳过`); continue }
    const biz = await loadBiz(locale)
    const have = new Set(Object.keys(biz))
    const missing = enKeys.filter((k) => !have.has(k))
    if (!missing.length) { console.log(`${locale}: 无缺口`); continue }

    let src = fs.readFileSync(full, 'utf8')
    const lines = []
    let written = 0
    for (let i = 0; i < missing.length; i += CHUNK) {
      const chunk = missing.slice(i, i + CHUNK)
      let dict = {}
      try {
        dict = await translateBatch(locale, chunk)
      } catch (e) {
        console.log(`\n  ${locale} 批次 ${Math.floor(i / CHUNK) + 1} 失败: ${e.message}`)
        continue
      }
      for (const k of chunk) {
        const v = dict[k]
        if (!v || !String(v).trim()) continue
        if (src.includes(`'${escKey(k)}':`)) continue
        lines.push(`    '${escKey(k)}': '${escVal(v)}',`)
        written++
      }
      process.stdout.write(`\r  ${locale}: ${Math.min(i + CHUNK, missing.length)}/${missing.length} 已写入 ${written}`)
    }
    if (lines.length) {
      const idx = src.lastIndexOf('  },')
      if (idx < 0) { console.log(`\n${locale}: 找不到插入点,跳过`); continue }
      src = src.slice(0, idx) + lines.join('\n') + '\n' + src.slice(idx)
      fs.writeFileSync(full, src, 'utf8')
    }
    totalWritten += written
    console.log(`\r${locale}: 缺口 ${missing.length},新写入 ${written}`)
  }
  console.log(`\n合计写入 ${totalWritten} 条`)
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
