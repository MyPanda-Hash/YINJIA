/**
 * 2026-11-25 出货检验纸面(YJ-QR-154)版面修复补丁
 *   ① 只读态(提交/审核后)批次号必须仍然显示 —— 原来只有 v-if="editable" 的输入框,审批后整列只剩「批次号」
 *   ② 五个数据列统一:居中 + 行高 18px + 顶对齐(原来四套口径,填写时/填写完成后两个样)
 *   ③ 手工换行(pre-wrap)两种状态都保留
 * 用法: node _scratch/qc-insp-fmt/apply-patch.mjs    (幂等:已打过就报 already)
 */
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = 'D:/workspace/yinjia/frontend/src/core/qc/QcProcInspSheet.vue'
let src = readFileSync(FILE, 'utf8')
const before = src
const log = []

function rep(label, from, to, { expect = 1 } = {}) {
  const n = src.split(from).length - 1
  if (n !== expect) {
    if (n === 0) { log.push(`SKIP  ${label} (已打过)`); return }
    throw new Error(`[${label}] 期望命中 ${expect} 处,实际 ${n} 处`)
  }
  src = src.split(from).join(to)
  log.push(`OK    ${label}`)
}

/* ── ① 表头批次号格:可编辑态 = 改名输入框;只读态 = 批号文本 ───────────────── */
rep(
  '表头批次号格 · 输入框改为 editable 分支',
  `                  <div class="qr-batch-edit">
                    <el-input
                      v-if="editable"
                      :model-value="batchDraftOf(bi)"`,
  `                  <!-- 可编辑态:标签下面就是改名输入框(改 = 清单项 + 该批所有行一起改);
                       只读态(提交审批/审核通过后):**批号必须照原样留在纸上** ——
                       2026-11-25 用户报障「填写完成后不仅不显示批次号」:原来这里只有
                       v-if="editable" 的输入框,审批通过后整列只剩「批次号」三个字,
                       批号在整张纸面上无处可查(导出 Excel 的表头却还带着它)。 -->
                  <div v-if="editable" class="qr-batch-edit">
                    <el-input
                      :model-value="batchDraftOf(bi)"`,
)

rep(
  '表头批次号格 · 删批次小×不再重复判 editable(已在分支内)',
  `                    <span
                      v-if="editable && batches.length > 1"`,
  `                    <span
                      v-if="batches.length > 1"`,
)

rep(
  '表头批次号格 · 只读态渲染批号文本',
  `                    >×</span>
                  </div>
                </div>
              </th>`,
  `                    >×</span>
                  </div>
                  <span v-else class="qr-batch-value" :title="b">{{ b }}</span>
                </div>
              </th>`,
)

/* ── ② 五个数据列:统一居中 + 行高 18px + 顶对齐 ─────────────────────────── */
rep(
  '明细列 · 方法/要求 左对齐 → 五列统一居中',
  `/* 明细各列:要求/方法左对齐(文字长),批次号与结果居中 */
.qr-grid td.c-mtd,
.qr-grid td.c-req {
  text-align: left;
  vertical-align: top;
  line-height: 17px;
}
.qr-grid td.c-item {
  text-align: center;
  vertical-align: top;
}`,
  `/* 明细五个数据列:**一套口径** —— 居中 + 行高 18px + 顶对齐。
   2026-11-25 用户口径「表格需实现可手动换行,且格式一致居中」:
     原来 要求/方法 左对齐、行高 17px,项目/结果 居中,批次结果列"编辑态左、只读态居中"
     ⇒ 同一张纸四套口径,填写时与填写完成后是两个样子(用户报障「各行的格式还不一样」)。
   顶对齐保留(2026-11-23 定的:多行文本把行高撑高时,单行格不会看着掉到下一行)。 */
.qr-grid td.c-item,
.qr-grid td.c-mtd,
.qr-grid td.c-req,
.qr-grid td.c-batchtext,
.qr-grid td.c-result {
  text-align: center;
  vertical-align: top;
  line-height: 18px;
}`,
)

rep(
  '明细列 · 旧的 td.c-result 居中块(已被上面的合并且)',
  `.qr-grid td.c-result {
  text-align: center;
}
`,
  '',
)

/* ── ③ 输入控件(textarea)与只读文本:同一套居中 + 行高 ──────────────────── */
rep(
  '明细列 · 通用 textarea 左对齐 → 居中(项目格那条更具体的保持不动,由守卫测试钉住)',
  `.qr-cell-wrap :deep(.el-textarea__inner) {
  text-align: left;
  padding: 2px;
  line-height: 18px;
  resize: none;
  font-family: inherit;
}`,
  `.qr-cell-wrap :deep(.el-textarea__inner) {
  /* 2026-11-25:录入态的 textarea 也居中 —— 与只读态 .qr-cell-text 同一口径
     (原来这里 text-align:left,同一个格"填写时靠左、填写完成后居中") */
  text-align: center;
  padding: 2px;
  line-height: 18px;
  resize: none;
  font-family: inherit;
}`,
)

rep(
  '单行输入(方法/要求列历史控件)左对齐 → 居中',
  `.qr-grid td.c-mtd .qr-cell-input :deep(.el-input__inner),
.qr-grid td.c-req .qr-cell-input :deep(.el-input__inner) {
  text-align: left;
}`,
  `.qr-grid td.c-mtd .qr-cell-input :deep(.el-input__inner),
.qr-grid td.c-req .qr-cell-input :deep(.el-input__inner) {
  text-align: center;
}`,
)

rep(
  '只读文本 · 统一居中 + 行高 18px(原来默认左对齐,靠三条列选择器分别居中)',
  `.qr-cell-text {
  display: inline-block;
  min-height: 18px;
  white-space: pre-wrap;
  text-align: left;
  width: 100%;
}
.qr-grid td.c-item .qr-cell-text,
.qr-grid td.c-result .qr-cell-text,
.qr-grid td.c-batchtext .qr-cell-text {
  text-align: center;
}`,
  `/* 只读文本:居中 + 行高 18px + pre-wrap(手工换行两种状态都留得住)
   —— 列级选择器不再需要:五个数据列现在同一套口径。 */
.qr-cell-text {
  display: inline-block;
  min-height: 18px;
  white-space: pre-wrap;
  text-align: center;
  line-height: 18px;
  width: 100%;
}`,
)

/* ── ④ 表头批号文本 + 判定下拉选中值居中 ─────────────────────────────────── */
rep(
  '样式 · 新增 .qr-batch-value(只读态批号)',
  `.qr-batch-del {
  flex: none;`,
  `/* 只读态的批号文本(与可编辑态输入框同一位置、同一字号):批号在纸上不能消失 */
.qr-batch-value {
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  color: #1f4e79;
  text-align: center;
  white-space: pre-wrap;
  word-break: break-all;
}
.qr-batch-del {
  flex: none;`,
)

rep(
  '样式 · 判定下拉选中值居中',
  `.qr-grid td.c-result .qr-cell-input :deep(.el-select__placeholder) {
  text-align: center;
}`,
  `.qr-grid td.c-result .qr-cell-input :deep(.el-select__placeholder),
.qr-grid td.c-result .qr-cell-input :deep(.el-select__selected-item) {
  text-align: center;
  line-height: 18px;
}`,
)

if (src === before) {
  console.log('already patched — nothing to do')
} else {
  if (/\r\n/.test(src)) throw new Error('补丁把文件写成了 CRLF,中止')
  writeFileSync(FILE, src, 'utf8')
  console.log(log.join('\n'))
  console.log(`\nwritten: ${FILE} (${before.length} -> ${src.length} chars)`)
}
