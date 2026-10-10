// _v-served-menus.mjs — 复核 8090 实际下发的前端里,品质管理那三张新检验单到底在不在
const BASE = 'http://127.0.0.1:8090';

async function main() {
  const html = await (await fetch(BASE + '/')).text();
  const entry = (html.match(/assets\/index-[A-Za-z0-9_-]+\.js/) || [])[0];
  const js = await (await fetch(BASE + '/' + entry)).text();
  console.log('入口 chunk: ' + entry + '  (' + (js.length / 1024).toFixed(0) + ' KB)');

  const needles = ['QC_MOLD_INSP', 'QC_CUT_INSP', 'QC_ASM_INSP',
    '成型检验单', '切炭检验单', '组装成品检验单', '制程品质',
    'qcMoldInsp', 'qcCutInsp', 'qcAsmInsp',
    // 已下架的两组不该再出现
    'QC_DISPOSAL', 'LOT_TRACE', 'QC_OP'];
  for (const n of needles) {
    const hit = js.includes(n);
    console.log('  ' + (hit ? '✅ 有' : '❌ 无') + '  ' + n);
  }

  // 菜单对象附近打印一段,人工确认结构
  const i = js.indexOf('qcMoldInsp');
  if (i >= 0) {
    console.log('\n--- qcMoldInsp 上下文 ---');
    console.log(js.slice(Math.max(0, i - 260), i + 340).replace(/\s+/g, ' '));
  }
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
