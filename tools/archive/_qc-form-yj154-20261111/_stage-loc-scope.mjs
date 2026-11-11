// 只把「本任务这一轮的两处文案替换」暂存进 10 个语言包(基于 HEAD blob,保留其它任务的未提交词条)
const { execSync, spawnSync } = await import('node:child_process')
const fs = await import('node:fs/promises')
const ROOT = 'D:/workspace/yinjia'
const OLD_HINT = '选项库全系统共用，改动会影响所有单据（历史单据已填的值不受影响）'
const NEW_HINT = '仅「出货检验单功能」使用，改动只影响本面板（历史单据已填的值不受影响）'
const OLD_LIM = '选项内容不能超过30个字'
const NEW_LIM = '选项内容不能超过200个字'
const T = {
  en: 'Used by "Outgoing Inspection Sheet (Functional)" only; changes affect this panel only (values already saved stay unchanged).',
  ja: '「出荷検査（機能）シート」専用です。変更はこのパネルのみに影響します（保存済みの値は変わりません）。',
  ko: '「출하 검사(기능) 시트」 전용입니다. 변경은 이 패널에만 영향을 줍니다(저장된 값은 유지).',
  'zh-TW': '僅「出貨檢驗單功能」使用，改動只影響本面板（歷史單據已填的值不受影響）',
  es: 'Solo para «Hoja de inspección de salida (funcional)»; los cambios afectan solo a este panel (los valores ya guardados no cambian).',
  de: 'Nur für „Ausgangsprüfblatt (funktional)"; Änderungen betreffen nur dieses Panel (gespeicherte Werte bleiben).',
  fr: 'Utilisé uniquement par « Fiche d’inspection sortante (fonctionnelle) » ; les modifications n’affectent que ce panneau.',
  ru: 'Только для «Лист исходящего контроля (функциональный)»; изменения затрагивают только эту панель.',
  vi: 'Chỉ dùng cho «Phiếu kiểm tra xuất hàng (chức năng)»; thay đổi chỉ ảnh hưởng bảng này.',
  th: 'ใช้เฉพาะ «ใบตรวจสอบขาออก (เชิงหน้าที่)» การเปลี่ยนแปลงมีผลเฉพาะแผงนี้',
}
const L = {
  en: 'An option must be at most 200 characters',
  ja: '選択肢は200文字以内です',
  ko: '선택지는 200자 이내입니다',
  'zh-TW': '選項內容不能超過200個字',
  es: 'La opción no puede superar 200 caracteres',
  de: 'Option darf höchstens 200 Zeichen haben',
  fr: 'L’option ne peut pas dépasser 200 caractères',
  ru: 'Вариант не длиннее 200 символов',
  vi: 'Tùy chọn tối đa 200 ký tự',
  th: 'ตัวเลือกยาวไม่เกิน 200 ตัวอักษร',
}
const quote = (s) => (s.includes("'") ? `"${s.replace(/"/g, '\\"')}"` : `'${s}'`)
for (const loc of Object.keys(T)) {
  const path = `frontend/src/i18n/locales/${loc}.js`
  const head = spawnSync('git', ['cat-file', 'blob', `HEAD:${path}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).stdout
  let s = head.toString('utf8')
  const lines = s.split('\n')
  const out = lines.map((ln) => {
    if (ln.includes(`'${OLD_HINT}'`)) return `    '${NEW_HINT}': ${quote(T[loc])},`
    if (ln.includes(`'${OLD_LIM}'`)) return `    '${NEW_LIM}': ${quote(L[loc])},`
    return ln
  })
  const clean = out.join('\n')
  if (clean === s) { console.log('NOCHANGE ' + loc); continue }
  const tmp = `${ROOT}/.tmp-loc-${loc}.js`
  await fs.writeFile(tmp, clean, 'utf8')
  const sha = execSync(`git hash-object -w --no-filters "${tmp}"`, { cwd: ROOT, encoding: 'utf8' }).trim()
  execSync(`git update-index --cacheinfo 100644,${sha},${path}`, { cwd: ROOT })
  await fs.unlink(tmp)
  console.log('STAGED ' + loc)
}
