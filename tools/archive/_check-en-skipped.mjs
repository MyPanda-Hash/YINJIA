// 核对:被跳过的 key 在本地 en.js 里的既有译名(判断生产域界面英文是否可接受)
import fs from 'node:fs';
const t = fs.readFileSync('frontend/src/i18n/locales/en.js', 'utf8');
const keys = ['查询条件', '行', '合计', '已生成', '张', '操作人', '已完工', '启用', '停用', '已停用', '已启用',
  '操作失败', '预开工日', '预完工日', '客户', '加工单号', '单据日期', '产品编号', '型号', '单位', '全部', '确认将选中的'];
for (const k of keys) {
  const re = new RegExp("^\\s*'" + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'\\s*:\\s*(.*)$", 'm');
  const m = t.match(re);
  console.log(k.padEnd(12), m ? m[1].trim() : '(缺失)');
}
