/**
 * _probe-spec-e2e-flow.cjs 鈥斺€?瑙勬牸涔︽暟鎹?+ 涓ゆ潯璺ㄩ潰鏉垮鍏ラ摼鐨勭鍒扮楠岃瘉(2026-10-13)
 *
 * 鐢ㄦ埛瑕佹眰:銆屽啓涓€涓鏍间功鐨勬暟鎹劧鍚庤繘琛屼竴涓皬鐨勬祦绋嬮獙璇?娴嬭瘯鍒氭墠鐨勫姛鑳芥槸鍚︽纭繍琛屼簡銆嶃€? *
 * 楠岃瘉鐨勪笁浠朵簨:
 *   鈶?瑙勬牸涔?浜у搧缂栧彿=CSCS)濉ソ銆屾楠岃姹傘€? 琛?+ 銆岀墿鏂欐竻鍗曘€? 琛?
 *   鈶?**鏈鎵?*鐘舵€佷笅 鈥斺€?鍑鸿揣妫€楠岃鍒掕〃閾?/px/specByProduct)涓庣粍瑁匓OM閾?/px/specByProductForAsm)
 *      閮藉繀椤?*涓嶅甫浠讳綍鏄庣粏**(搴斿洖鎶?reason=not_approved),杩欐鏄敤鎴疯鐨?瑙勬牸涔︽病閫氳繃瀹℃壒灏变笉鑳藉鍏?;
 *   鈶?**瀹℃壒閫氳繃(宸插綊妗?** 鍚?鈥斺€?涓ゆ潯閾惧悇鑷甫鍥炶嚜宸辫〃鍖虹殑琛?妫€楠岃姹?/ 鐗╂枡娓呭崟),
 *      涓?*浜掍笉涓茶〃**(妫€楠岄摼鍙嚭妫€楠岃銆丅OM 閾惧彧鍑虹墿鏂欒)銆? *
 * 鏄庣粏杞借嵎鏍煎紡鍙栬嚜 SelectVoucherDialog.vue:393 鈥斺€?formData.detail.items銆? * 璐﹀ YJ_TEST銆備細鍦ㄦ祴璇曞簱閲屽啓 1 寮犺鏍间功鍗?SD-2026-10-0001,鏈氨鎶婁骇鍝佺紪鍙风暀绌虹殑閭ｅ紶),
 * 鏈熬鎵撳嵃璇ュ崟鐨勬渶缁堢姸鎬?瑕佹竻鐞嗙殑璇濇寜 _cleanup 娈电殑璇存槑鎵ц銆? *
 * 鐢ㄦ硶:node tools/archive/_probe-spec-e2e-flow.cjs
 */
'use strict'

const API = 'http://127.0.0.1:8090/api'
const FACTORY = 'YJ_TEST'
const DOC = process.argv[2] || 'SD-2026-10-0001'
const PRODUCT = 'CSCS'

const CELLS = []
let PASS = 0, FAIL = 0
function check(id, expect, ok, actual) {
  if (ok) PASS++; else FAIL++
  CELLS.push({ id, ok, expect, actual })
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${id}\n        鏈熸湜: ${expect}\n        瀹為檯: ${actual}`)
}
const show = (r) => `code=${r.code} msg=銆?{r.msg}銆峘

async function login(u) {
  const r = await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: u, password: '123456', factory: FACTORY }),
  })).json()
  if (r?.code !== 200) throw new Error(`鐧诲綍澶辫触 ${u}`)
  return { token: r.data.token, name: r.data.user.realName, isAdmin: r.data.user.isAdmin }
}

async function call(tk, buttonName, formData) {
  const r = await fetch(`${API}/px/callButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
    body: JSON.stringify({ panelCode: 'RD_SPEC_DOC', buttonName, formData: formData || {}, buttonParam: {} }),
  }).then(async (x) => {
    let j = null
    const t = await x.text()
    try { j = JSON.parse(t) } catch { /* 闈?JSON */ }
    return { code: j?.code ?? x.status, msg: j?.message ?? t.slice(0, 120), data: j?.data }
  })
  return r
}

/** 瑙勬牸涔﹂噷涓ゅ紶琛ㄥ尯鐨勬牱渚嬫暟鎹?閿竴寰嬩腑鏂囧瓧娈?label 鈥斺€?鏈」鐩搧寰? */
const DETAIL = [
  { 琛ㄥ尯: '妫€楠岃姹?, 搴忓彿: '1', 妫€楠岄」鐩? '澶栬', 妫€楠岃姹? '鏃犻粦鐐广€佹棤鐮存崯銆佹棤姣涘埡', 妫€楠屾柟娉? '鐩妫€鏌?, 妫€楠屼緷鎹? 'YJ-Q-30' },
  { 琛ㄥ尯: '妫€楠岃姹?, 搴忓彿: '2', 妫€楠岄」鐩? '灏哄', 妫€楠岃姹? '澶栧緞 20卤0.5mm銆侀暱搴?250卤2mm', 妫€楠屾柟娉? '娓告爣鍗″昂', 妫€楠屼緷鎹? 'YJ-Q-30' },
  { 琛ㄥ尯: '鐗╂枡娓呭崟', 搴忓彿: '1', 鐗╂枡缂栫爜: 'M-001', 鐗╂枡鍚嶇О: '鐐', 瑙勬牸鍙傛暟: '', 鏁伴噺: '1', 澶囨敞: '' },
  { 琛ㄥ尯: '鐗╂枡娓呭崟', 搴忓彿: '2', 鐗╂枡缂栫爜: 'M-003', 鐗╂枡鍚嶇О: '鐐氦缁?, 瑙勬牸鍙傛暟: '', 鏁伴噺: '1', 澶囨敞: '' },
]

async function fetchSpec(tk, url) {
  const r = await fetch(`${API}${url}`, { headers: { Authorization: `Bearer ${tk}` } }).then((x) => x.json())
  return r?.data || {}
}
const areas = (items) => [...new Set((items || []).map((r) => String(r['琛ㄥ尯'] || '')))]

async function main() {
  console.log(`\n=== 瑙勬牸涔︽暟鎹?+ 璺ㄩ潰鏉垮鍏ラ摼绔埌绔獙璇?璐﹀ ${FACTORY} / 鍗?${DOC} / 浜у搧 ${PRODUCT}) ===`)
  const ad = await login('admin')
  const cp = await login('cp')
  console.log(`  admin = ${ad.name}(isAdmin=${ad.isAdmin}) / cp = ${cp.name}(isAdmin=${cp.isAdmin})`)
  console.log('  鈿?鐢?cp 鍐欐暟鎹?闈炵鐞嗗憳鍦?RD_SPEC_DOC 涓娿€屼繚瀛樸€? 閫佸(pending=Y),涓嶆槸"淇濆瓨鍗冲綊妗?,')
  console.log('     鎵€浠ユ墠鑳介€犲嚭"瑙勬牸涔﹀瓨鍦ㄤ絾鏈鎵?杩欎釜寰呴獙鐘舵€?admin 淇濆瓨浼氱洿鎺ュ綊妗ｃ€佸帇涓嶅洖鑽夌銆?)

  // 鈹€鈹€ 鈶?cp 鏂板缓涓€寮犲共鍑€鐨勮鏍间功鑽夌 + 鍐欏叆瀹屾暣鏁版嵁 鈹€鈹€
  //    鈿?蹇呴』**鏂板缓**鑰屼笉鏄鐢ㄦ棦鏈夊崟:涓婁竴娆¤繍琛屼細鎶?SD-2026-10-0001 鍙樻垚銆屽凡褰掓。銆?
  //      鑰屽綊妗ｇ姸鎬佸帇涓嶅洖鏈鎵?docStatusOf 閲屽凡褰掓。浼樺厛绾ч珮浜庡鎵逛腑),澶嶇敤灏辨祴涓嶅埌闂ㄧ銆?  console.log('\n鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ 鈶?cp 鏂板缓瑙勬牸涔﹀崟骞跺啓鍏ユ暟鎹?鏈鎵圭姸鎬? 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€')
  const rDraft = await call(cp.token, '淇濆瓨涓鸿崏绋?, {})
  const docNo = String(rDraft.data?.['缂栧彿'] ?? '')
  console.log(`  [cp] 鏂板缓鑽夌: ${show(rDraft)} 鈫?鍗曞彿 ${docNo || '(鏃?'}`)
  check('0-newdoc', 'cp 鑳芥柊寤鸿鏍间功鑽夌(鎷垮埌鍗曞彿)', rDraft.code === 200 && !!docNo, `鍗曞彿=${docNo || '(鏃?'}`)
  if (!docNo) throw new Error('娌℃嬁鍒版柊鍗曞彿,鍚庣画鏃犳硶楠岃瘉')
  const rSave = await call(cp.token, '淇濆瓨', {
    缂栧彿: docNo, 鍗曟嵁鏃ユ湡: '2026-10-13', 浜у搧缂栧彿: PRODUCT,
    detail: { items: DETAIL },
  })
  console.log(`  [cp] 淇濆瓨(甯︽暟鎹?: ${show(rSave)}`)
  check('1-save', 'cp 淇濆瓨鎴愬姛(搴旇繘銆屽鎵逛腑銆? 鏈鎵?', rSave.code === 200, show(rSave))

  const st1 = String(rSave.data?.['鍗曟嵁鐘舵€?] ?? '')
  console.log(`  淇濆瓨鍚庡崟鎹姸鎬?= 銆?{st1}銆峘)
  check('1b-not-approved', '鐘舵€佺‘涓烘湭瀹℃壒(瀹℃壒涓?鑽夌),闂ㄧ璇ユ嫤',
    ['瀹℃壒涓?, '寰呬簩绾у鎵?, '鑽夌'].includes(st1), `鐘舵€?銆?{st1}銆峘)

  // 鈹€鈹€ 鈶?鏈鎵瑰垎鏀?涓ゆ潯閾鹃兘蹇呴』"涓€鏍间笉甯? 鈹€鈹€
  console.log('\n鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ 鈶?鏈鎵规椂鐨勯棬绂?搴斾竴涓牸閮戒笉甯? 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€')
  const insp0 = await fetchSpec(ad.token, `/px/specByProduct?code=${encodeURIComponent(PRODUCT)}`)
  const asm0 = await fetchSpec(ad.token, `/px/specByProductForAsm?code=${encodeURIComponent(PRODUCT)}`)
  check('2a-insp-blocked', '鍑鸿揣妫€楠岄摼: found=false 涓?reason=not_approved(涓€涓楠岄」閮戒笉甯?',
    insp0.found === false && insp0.reason === 'not_approved',
    `found=${insp0.found} reason=${insp0.reason} 瑙勬牸涔?${insp0['瑙勬牸涔︾紪鍙?] || ''} 鐘舵€?${insp0['瑙勬牸涔︾姸鎬?] || ''} items=${(insp0.items || []).length}`)
  check('2b-asm-blocked', '缁勮BOM閾? found=false 涓?reason=not_approved(涓€涓墿鏂欒閮戒笉甯?',
    asm0.found === false && asm0.reason === 'not_approved',
    `found=${asm0.found} reason=${asm0.reason} items=${(asm0.items || []).length}`)

  // 鈹€鈹€ 鈶?鐢?admin 瀹℃壒閫氳繃 鈫?褰掓。,鍐嶉獙涓ゆ潯閾惧悇鑷甫鍥炶嚜宸辫〃鍖虹殑琛?鈹€鈹€
  console.log('\n鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ 鈶?admin 瀹℃壒閫氳繃 鈫?鍐嶅彇鏁?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€')
  let st = st1
  if (st !== '宸插鏍? && st !== '宸插綊妗?) {
    const rApp = await call(ad.token, '瀹℃壒閫氳繃', { 缂栧彿: DOC })
    st = String(rApp.data?.['鍗曟嵁鐘舵€?] ?? '')
    console.log(`  [admin] 瀹℃壒閫氳繃: ${show(rApp)} 鈫?鐘舵€併€?{st}銆峘)
  }
  check('3-archived', '瑙勬牸涔﹀凡杩涘叆銆屽凡瀹℃牳/宸插綊妗ｃ€?闂ㄧ鏀捐鍓嶆彁)', st === '宸插鏍? || st === '宸插綊妗?, `鐘舵€?銆?{st}銆峘)

  const insp1 = await fetchSpec(ad.token, `/px/specByProduct?code=${encodeURIComponent(PRODUCT)}`)
  const asm1 = await fetchSpec(ad.token, `/px/specByProductForAsm?code=${encodeURIComponent(PRODUCT)}`)
  console.log(`  妫€楠岄摼杩斿洖: ${JSON.stringify({ found: insp1.found, matched: insp1.matched, items: (insp1.items || []).length, areas: areas(insp1.items) })}`)
  console.log(`  BOM  閾捐繑鍥? ${JSON.stringify({ found: asm1.found, matched: asm1.matched, items: (asm1.items || []).length, areas: areas(asm1.items) })}`)

  check('4a-insp-found', `瀹℃壒鍚庢楠岄摼 found=true 涓斿甫鍥?${2} 鏉°€屾楠岃姹傘€嶈`,
    insp1.found === true && (insp1.items || []).length === 2, `found=${insp1.found} items=${(insp1.items || []).length}`)
  check('4b-asm-found', `瀹℃壒鍚?BOM 閾?found=true 涓斿甫鍥?${2} 鏉°€岀墿鏂欐竻鍗曘€嶈`,
    asm1.found === true && (asm1.items || []).length === 2, `found=${asm1.found} items=${(asm1.items || []).length}`)
  check('4c-no-cross', '涓ゆ潯閾句簰涓嶄覆琛?妫€楠岄摼鐨勮涓嶅惈鐗╂枡鍒椼€丅OM 閾剧殑琛屼笉鍚楠屽垪',
    (insp1.items || []).every((r) => !r['鐗╂枡缂栫爜'] && !r['鐗╂枡鍚嶇О'])
      && (asm1.items || []).every((r) => !r['妫€楠岄」鐩?] && !r['妫€楠岃姹?]),
    `妫€楠岄摼棣栬=${JSON.stringify((insp1.items || [])[0] || {})} | BOM閾鹃琛?${JSON.stringify((asm1.items || [])[0] || {})}`)
  check('5-insp-cols', '妫€楠岄摼鐨勮甯︾潃 妫€楠岄」鐩?妫€楠岃姹?妫€楠屾柟娉?BOM 鍒椾笉璇ュ嚭鐜?',
    (insp1.items || []).every((r) => r['妫€楠岄」鐩?] && r['妫€楠岃姹?] && r['妫€楠屾柟娉?] !== undefined)
      && (insp1.items || []).every((r) => !r['鐗╂枡缂栫爜']),
    JSON.stringify((insp1.items || [])[0] || {}))
  check('5b-asm-cols', 'BOM 閾剧殑琛屽甫鐫€ 鐗╂枡缂栫爜/鐗╂枡鍚嶇О(BOM 姝ｇ‘鐨勪袱鏀?SQL)',
    (asm1.items || []).every((r) => r['鐗╂枡缂栫爜'] && r['鐗╂枡鍚嶇О']),
    JSON.stringify((asm1.items || [])[0] || {}))

  console.log('\n鈺愨晲鈺愨晲鈺愨晲鈺愨晲 姹囨€?鈺愨晲鈺愨晲鈺愨晲鈺愨晲')
  console.log(`鏍煎瓙鏁?${CELLS.length}  PASS=${PASS}  FAIL=${FAIL}`)
  for (const c of CELLS.filter((x) => !x.ok)) console.log(`  鉁?${c.id}\n      鏈熸湜: ${c.expect}\n      瀹為檯: ${c.actual}`)
  console.log(`\n娓呯悊鎻愮ず:鏈剼鏈啓鐨勬槸娴嬭瘯搴?${DOC}(浜у搧缂栧彿=${PRODUCT})銆傝杩樺師鎴?娌＄粦浜у搧缂栧彿"鐨勭┖鐧藉崟,`)
  console.log(`  鎵ц UPDATE rd_spec_doc_head SET 浜у搧缂栧彿=NULL WHERE 鍗曟嵁缂栧彿=N'${DOC}'; 骞舵竻 rd_spec_doc_detail 瀵瑰簲琛屻€俙)
  process.exit(FAIL ? 1 : 0)
}

main().catch((e) => { console.error('鑴氭湰寮傚父:', e.message); process.exit(2) })
