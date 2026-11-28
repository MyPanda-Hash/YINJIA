// 生成出货单纸面样张(与用户截图同数据):用真实模块 shipNoteHtml 渲染,供浏览器截图核对
import { writeFileSync } from 'node:fs';
import { shipNoteHtml } from '../frontend/src/business/shipNote.js';

const doc = {
  单据编号: 'XSCK-20261128-00006',
  单据日期: '2026-11-28',
  客户: '南京倍斯特环保科技有限公司',
  客户编码: 'B-47',
};
// 同一物料两批(300+200=500) + 另一个物料一批 50；另加一行 PC0000 占位批号验证"不印废话"
const lines = [
  { 存货编码: 'B-47-13', 存货名称: 'X+级烧结炭棒/滤芯', 规格型号: 'L: 275±0.5mm', 计量单位: '支', 数量: 300, 批次号: '20261114-BST-001', 源单编号: 'LZW-20261116-05' },
  { 存货编码: 'B-47-13', 存货名称: 'X+级烧结炭棒/滤芯', 规格型号: 'L: 275±0.5mm', 计量单位: '支', 数量: 200, 批次号: '104-015-010', 源单编号: 'LZW-20261116-05' },
  { 存货编码: 'T228', 存货名称: 'X烧结阻垢炭棒/滤芯', 规格型号: 'L: 284.5±0.5', 计量单位: '支', 数量: 50, 批次号: '101-015-009', 源单编号: 'LZW-20261127-02' },
  { 存货编码: 'T228', 存货名称: 'X烧结阻垢炭棒/滤芯', 规格型号: 'L: 284.5±0.5', 计量单位: '支', 数量: 0, 批次号: 'PC0000', 源单编号: 'LZW-20261127-02' },
];

const html = shipNoteHtml(doc, lines);
writeFileSync(new URL('./shipnote-sample.html', import.meta.url),
  `<!doctype html><meta charset="utf-8"><title>出货单样张</title><body style="margin:0;background:#fff">${html}</body>`, 'utf8');
console.log('已生成 shipnote-sample.html，长度', html.length);
