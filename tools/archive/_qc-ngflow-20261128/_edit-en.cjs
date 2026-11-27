const fs = require('fs');
const f = 'D:/YINJIA-main/frontend/src/i18n/locales/en.js';
let s = fs.readFileSync(f, 'utf8');
const anchor = "    '还没有特采单': 'No concession yet',";
const add = [
  "    // ---- 不合格品处理单(来料)(2026-11-28:特采单正名;检验结论=不合格自动生单、回填检验单「特采」)----",
  "    '还没有不合格品处理单(来料):检验数据记录判「不合格」并审批通过后自动生成': 'No incoming nonconforming disposal yet: it is created automatically once the inspection data record is judged “Nonconforming” and approved',",
  "    '待不合格品处理': 'To dispose nonconforming',",
  "    '不合格品处理': 'Nonconforming disposal',",
  "    '不合格品处理单(来料)': 'Incoming Nonconforming Disposal',",
  "    '不合格品处理单': 'Nonconforming Disposal',",
  "    '不合格品处理单号': 'Nonconforming Disposal No.',",
  "    '跳转到该不合格品处理单': 'Jump to the nonconforming disposal',",
  "    '特采→采购入库': 'Concession → purchase receipt',",
  "'还没有特采单': 'No concession yet',"
].join('\n');
if (!s.includes(anchor)) throw new Error('anchor missing');
s = s.replace(anchor, add);
fs.writeFileSync(f, s, 'utf8');
console.log('en.js ok');
