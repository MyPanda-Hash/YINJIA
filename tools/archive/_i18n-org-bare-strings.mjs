/**
 * _i18n-org-bare-strings.mjs — 把 OrgAdmin.vue 里未走 tt() 的显示文案包成 tt()(2026-09-23)
 *
 * 背景:AGENTS.md 多语言强制规范「禁止在模板里裸写无翻译路径的中文显示」——
 * 该文件 JS 侧的 ElMessage/ElMessageBox 文案一直没走 tt(),英文/日文界面下仍显示中文。
 * 本脚本只做机械包裹(不动机器可读的数据键),拼接式确认框已在源码里手工改成占位符模式。
 *
 * 安全:①只处理「整串字面量」'<字>' → tt('<字>') ②跳过注释 ③跳过已在 tt() 里的
 *      ④改完复扫,残留必须为 0(dry-run 报数不写盘)。
 * 用法:node tools/archive/_i18n-org-bare-strings.mjs [--dry]
 */
import fs from 'node:fs';

const DRY = process.argv.includes('--dry');
const file = 'frontend/src/views/sys/OrgAdmin.vue';
const src = fs.readFileSync(file, 'utf8');
const lines = src.split('\n');

// 需要包 tt() 的键(与源码逐字一致;含中文即键)
const KEYS = [
  '批量分配失败', '复制权限失败', '部门加载失败', '用户列表加载失败', '角色列表加载失败',
  '请输入部门名称', '部门已保存', '保存失败', '请输入账号', '用户已保存',
  '请填写编码与名称', '角色已创建', '创建失败', '角色已删除', '删除失败', '提示',
  '面板权限加载失败', '面板权限已保存',
];

let changed = 0;
const out = lines.map((line, i) => {
  const cm = line.indexOf('//');
  const code = cm >= 0 ? line.slice(0, cm) : line;
  const comment = cm >= 0 ? line.slice(cm) : '';
  let newCode = code;
  for (const k of KEYS) {
    const lit = "'" + k + "'";
    let from = 0;
    for (;;) {
      const at = newCode.indexOf(lit, from);
      if (at < 0) break;
      const before = newCode.slice(Math.max(0, at - 12), at);
      if (/tt\(\s*$/.test(before)) { from = at + lit.length; continue; }  // 已在 tt() 里
      newCode = newCode.slice(0, at) + 'tt(' + lit + ')' + newCode.slice(at + lit.length);
      changed++;
      console.log('  L' + (i + 1) + '  ' + k);
      from = at + lit.length + 3;
    }
  }
  return newCode + comment;
});

console.log('\n共包裹 ' + changed + ' 处');
if (DRY) { console.log('dry-run,未写盘'); process.exit(0); }
fs.writeFileSync(file, out.join('\n'));

// 复扫:应无残留(仅允许已知的数据键/渲染值)
const re = fs.readFileSync(file, 'utf8').split('\n');
let left = 0;
re.forEach((l, i) => {
  const cm = l.indexOf('//');
  const code = cm >= 0 ? l.slice(0, cm) : l;
  if (/^\s*(\*|\/\*)/.test(code)) return;
  for (const s of code.match(/'[^']*[\u4e00-\u9fa5][^']*'/g) || []) {
    if (/tt\(\s*$/.test(code.slice(0, code.indexOf(s)))) continue;
    left++;
    console.log('  残留 L' + (i + 1) + ': ' + s);
  }
});
console.log('复扫残留 ' + left + ' 处' + (left ? '(人工确认是否数据键)' : ' ✓'));
