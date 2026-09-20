// 一次性探针:加载前端菜单树,打印「既是面板又带子项」的条目 + 采购/销售相关全部条目
import { menuTree } from '../../frontend/src/business/menus.js';

const walk = (nodes, depth = 0, parents = []) => {
  for (const n of nodes) {
    const pad = '  '.repeat(depth);
    const flags = [n.path ? 'PATH' : '', n.children?.length ? `CHILD(${n.children.length})` : '', n.panelCode ? `panel=${n.panelCode}` : '']
      .filter(Boolean).join(' ');
    console.log(`${pad}- ${n.title}  [${n.code}] ${flags}`);
    if (n.path && n.children?.length) console.log(`${pad}  *** 可展开的面板条目(自身有页面+子项)`);
    if (n.children?.length) walk(n.children, depth + 1, [...parents, n.title]);
  }
};
console.log('=== 完整菜单树 ===');
walk(menuTree);

console.log('\n=== 自身带页面又有子项的所有条目 ===');
const both = [];
const find = (nodes) => { for (const n of nodes) { if (n.path && n.children?.length) both.push(n); if (n.children) find(n.children); } };
find(menuTree);
for (const n of both) console.log(`  ${n.title} [${n.code}] path=${n.path} 子项=${n.children.map((c) => c.title).join(' / ')}`);
if (!both.length) console.log('  (无)');
