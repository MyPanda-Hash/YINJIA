const fs = require('fs');
const f = 'D:/YINJIA-main/frontend/src/core/qc/qcFlow.test.js';
let s = fs.readFileSync(f, 'utf8');
const pairs = [
["/* ── ②b 不合格分支(2026-11-12 第二轮:检验→退货→特采→入库) ── */\ntest('不合格分支:有退回单/特采单时显示,节点各自带状态与面板码', () => {\n  const chain = buildChain({\n    需检验: 1,\n    送料暂收单号: 'SL-2026-10-0085', 送料状态: '已审核',\n    检验单号: 'IJ-2026-10-0030', 检验状态: '已审核', 合格数量: 0, 不合格数量: 100, 检验结论: '不合格',\n    退货单号: 'TH-2026-10-0007', 退货状态: '已审核', 退货日期: '2026-10-21',\n    特采单号: 'TCI-2026-10-0003', 特采状态: '审批中', 特采日期: '2026-10-22',\n  })\n  assert.equal(chain.showNg, true)\n  assert.deepEqual(chain.ng.map((n) => n.panel), ['QC_RETURN', 'QC_TC_IN'])\n  assert.deepEqual(chain.ng.map((n) => n.state), ['done', 'warn'])\n  assert.equal(chain.ng[0].no, 'TH-2026-10-0007')\n  assert.equal(chain.ng[1].status, '审批中')\n})",
"/* ── ②b 不合格分支(2026-11-28 改口径:检验数据记录判不合格 → 不合格品处理单(来料) → 特采分流) ── */\ntest('不合格分支:有不合格品处理单/退回单时显示,节点各自带状态与面板码', () => {\n  const chain = buildChain({\n    需检验: 1,\n    送料暂收单号: 'SL-2026-10-0085', 送料状态: '已审核',\n    检验单号: 'IJ-2026-10-0030', 检验状态: '已审核', 合格数量: 0, 不合格数量: 100, 检验结论: '不合格',\n    不合格品处理单号: 'TCI-2026-11-0003', 不合格品处理状态: '审批中', 不合格品处理日期: '2026-11-28',\n    退货单号: 'TH-2026-10-0007', 退货状态: '已审核', 退货日期: '2026-10-21',\n  })\n  assert.equal(chain.showNg, true)\n  // 2026-11-28:分支顺序 = 业务发生顺序(不合格品处理单先出,不特采才有退回单)\n  assert.deepEqual(chain.ng.map((n) => n.panel), ['QC_TC_IN', 'QC_RETURN'])\n  assert.deepEqual(chain.ng.map((n) => n.state), ['warn', 'done'])\n  assert.equal(chain.ng[0].no, 'TCI-2026-11-0003')\n  assert.equal(chain.ng[0].name, '不合格品处理单(来料)')\n  assert.equal(chain.ng[0].status, '审批中')\n})"],
["test('不合格分支:检验判了不合格但还没开退回单 → 分支显示两个「未生成」待办', () => {\n  const chain = buildChain({\n    需检验: 1, 送料暂收单号: 'SL-1', 送料状态: '已审核',\n    检验单号: 'IJ-1', 检验状态: '已审核', 检验结论: '不合格',\n  })\n  assert.equal(chain.showNg, true)\n  assert.deepEqual(chain.ng.map((n) => n.state), ['todo', 'todo'])\n  assert.deepEqual(chain.ng.map((n) => n.status), ['未生成', '未生成'])\n})",
"test('不合格分支:检验判了不合格但还没开不合格品处理单 → 两格都显示「未生成」待办', () => {\n  const chain = buildChain({\n    需检验: 1, 送料暂收单号: 'SL-1', 送料状态: '已审核',\n    检验单号: 'IJ-1', 检验状态: '已审核', 检验结论: '不合格',\n  })\n  assert.equal(chain.showNg, true)\n  assert.deepEqual(chain.ng.map((n) => n.state), ['todo', 'todo'])\n  assert.deepEqual(chain.ng.map((n) => n.status), ['未生成', '未生成'])\n})"],
];
let n = 0;
for (const [a, b] of pairs) { if (!s.includes(a)) { console.log('MISS'); continue; } s = s.replace(a, b); n++; }
fs.writeFileSync(f, s, 'utf8');
console.log('replaced', n);
