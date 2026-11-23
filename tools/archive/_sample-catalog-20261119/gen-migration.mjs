/**
 * 生成「送样登记表(SAMPLE_REG)内部检测目录」2026-11-19 版迁移脚本。
 *
 * 源文件:`提供系统更新版2026.11.17(1).xls` 的「内部检测目录」sheet
 *        (不存在该 sheet 时回退 Sheet1,兼容旧文件)
 * 输出:tools/migrate-sample-catalog-rev-20261119.sql
 *
 * 背景(2026-11-19):
 *   「(1) 版」文件的「内部检测目录」sheet 与旧 `提供系统更新版2026.11.17.xls` 的 Sheet1
 *   逐格内容完全一致(已用 xlsx 解析逐格 diff 核实),因此在册数据无需再改内容 ——
 *   本生成器/脚本是**在册复核 + 部署版**(幂等,重跑一次把两账套的目录对齐到同一份事实)。
 *
 * 口径(用户 2026-11-17,2026-11-19 复核沿用):
 *   1. 旧目录数据不需要了,整批换成新表内容;
 *   2. 「内部检出限」列改名为「标准方法检出限」(数据键=label 改名,物理列沿用)。
 *
 * 取值规则(Excel 里的合并/省略格):
 *   - 测试方法(D):空白 = 同上;唯一例外「色度」保持空白(上一个是 TDS笔,套用会错);
 *   - 测试周期(E):空白 = 同上(整表按行向下继承);
 *   - 收费(F):逐行原样,不继承(唯一空白 = 「色度」,保持空白待业务补价);
 *   - 检测标准(G)/检测标准备注(H):逐行原样,空白即空白(粉体密实震动/强度测试仪-炭棒/粒度 无标准);
 *   - 序号:照源文件;「高浓度银」源文件未编号 ⇒ 落 28(与其上一行 高浓度铅 同号,仅为保证排序)。
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const require = createRequire('D:/workspace/yinjia/frontend/package.json');
const XLSX = require('xlsx');

const SRC = process.argv[2] ||
  'C:/Users/vigna/Documents/WeChat Files/wxid_9he2bhyytczm22/FileStorage/File/2026-11/提供系统更新版2026.11.17(1).xls';
const OUT = process.argv[3] || 'D:/workspace/yinjia/tools/migrate-sample-catalog-rev-20261119.sql';

const wb = XLSX.readFile(SRC, { cellStyles: true });
// sheet 名优先取「内部检测目录」,不存在则回退旧文件的 Sheet1(不写死单一名字)
const SHEET = wb.SheetNames.includes('内部检测目录') ? '内部检测目录' : 'Sheet1';
const ws = wb.Sheets[SHEET];
if (!ws) throw new Error(`源文件里找不到 sheet「内部检测目录」也没有 Sheet1:${SRC}`);
console.log('SRC =', SRC);
console.log('SHEET =', SHEET, '!ref =', ws['!ref']);

const cellText = (r, c) => {
  const cell = ws[XLSX.utils.encode_cell({ r, c })];
  if (!cell) return '';
  const v = cell.w !== undefined ? cell.w : cell.v;
  return String(v === null || v === undefined ? '' : v).replace(/\r?\n/g, '\n').trim();
};
// 单元格内换行:视为排版折行,统一并成一行(检测标准多标准时用 '/',备注多条时用 '；')
const flat = (s, sep = '') => s.split('\n').map((x) => x.trim()).filter(Boolean).join(sep);

// ---- 逐行读取(0-based 行号;R3..R56 = 数据行,R57 = 「不能测的/外送部分」尾行)
const rows = [];
for (let r = 2; r <= 55; r++) {  // 1-based R3..R56;R57 = 尾行「不能测的/外送部分」由 EXTRA 承载
  // 列位(实测 !ref = B1:I60,A 列在声明范围之外):
  //   1=序号 2=检测元素 3=标准方法检出限 4=测试方法 5=测试周期 6=收费 7=检测标准 8=检测标准-备注
  const no = cellText(r, 1).trim();
  const elem = cellText(r, 2).trim();
  if (!elem) continue;
  if (no !== '' && !/^\d+$/.test(no)) continue;   // 尾行(「不能测的」)不当作检测项
  rows.push({
    sheetRow: r + 1,
    no: no === '' ? '' : String(Number(no)),
    elem,
    limit: flat(cellText(r, 3), ' '),
    method: flat(cellText(r, 4), ' '),
    period: flat(cellText(r, 5), ''),
    fee: flat(cellText(r, 6), ''),
    std: flat(cellText(r, 7), ''),   // 多标准在源表里已用 '/' 结尾换行,直接拼上即可
    stdNote: flat(cellText(r, 8), '；'),
  });
}

// ---- 测试方法 / 测试周期 / 收费:空白 = 同上
// 测试方法(E 列)只在「同组」内被合并格表达,色度不属于任何方法组合并区 ⇒ 保持空白
let lastMethod = '', lastPeriod = '';
for (const row of rows) {
  if (row.method) lastMethod = row.method;
  else row.method = row.elem === '色度' ? '' : lastMethod;
  if (row.period) lastPeriod = row.period; else row.period = lastPeriod;
  // 收费(G 列)逐行给值,不做「同上」推断:色度在源表里就是空白
}

// ---- 序号:高浓度银 源文件未编号
for (const row of rows) {
  if (row.elem === '高浓度银') row.no = '28';
}

// ---- 尾行:不能测的 / 外送部分
const EXTRA = {
  // 「不能测的:外送部分」在源表里没有序号(它是一句说明);但列表按 [序号] 升序,NULL 会排到最前,
  // 故沿用旧版「排最后」的口径,给 54(= 新版最大序号 53 之后)。
  no: '54',
  elem: '外送部分',
  limit: '',
  method: '',
  period: '',
  fee: '',
  std: '',
  stdNote: '据实需求际联系机构进行报价等信息',
  memo: '不能测的：外送部分据实需求际联系机构进行报价等信息',
};

// ---- SQL 字面量
const q = (s) => 'N' + "'" + String(s ?? '').replace(/'/g, "''") + "'";
const num = (s) => {
  const t = String(s ?? '').trim();
  if (!t) return 'NULL';
  const n = Number(t);
  return Number.isFinite(n) ? n.toFixed(2) : 'NULL';
};
const seqOf = (s) => (String(s ?? '').trim() === '' ? 'NULL' : String(Number(s)));

const upsert = (row) => {
  const cols = `序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注`;
  const vals = [
    seqOf(row.no), q(row.elem), q(row.limit), 'NULL',
    q(row.method), q(row.period), num(row.fee), q(row.std), q(row.stdNote), q(row.memo ?? ''),
  ].join(', ');
  return `-- ${row.no || '—'} ${row.elem}${row.sheetRow ? ` (源表 R${row.sheetRow})` : ''}
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = ${q(row.elem)})
  UPDATE dbo.qc_sample_reg SET ${cols.replace(/, /g, ' = ?X, ')} SET_PLACEHOLDER WHERE 检测元素 = ${q(row.elem)};
ELSE
  INSERT INTO dbo.qc_sample_reg (${cols}, asp_user1, asp_time1, asp_cancel)
  VALUES (${vals}, N'system', SYSDATETIME(), N'N');
`;
};

// 上面的占位写法太绕:直接用显式 UPDATE 语句体
const block = (row) => `-- ${row.no || '—'} ${row.elem}${row.sheetRow ? ` (源表 R${row.sheetRow})` : ''}
IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE 检测元素 = ${q(row.elem)})
BEGIN
  UPDATE dbo.qc_sample_reg SET
    序号 = ${seqOf(row.no)}, 内部检出限 = ${q(row.limit)}, 检测误差 = NULL,
    测试方法 = ${q(row.method)}, 测试周期 = ${q(row.period)}, 收费 = ${num(row.fee)},
    检测标准 = ${q(row.std)}, 检测标准备注 = ${q(row.stdNote)}, 备注 = ${q(row.memo ?? '')},
    asp_user2 = N'system', asp_time2 = SYSDATETIME(), asp_cancel = N'N'
  WHERE 检测元素 = ${q(row.elem)};
END
ELSE
BEGIN
  INSERT INTO dbo.qc_sample_reg
    (序号, 检测元素, 内部检出限, 检测误差, 测试方法, 测试周期, 收费, 检测标准, 检测标准备注, 备注, asp_user1, asp_time1, asp_cancel)
  VALUES
    (${seqOf(row.no)}, ${q(row.elem)}, ${q(row.limit)}, NULL, ${q(row.method)}, ${q(row.period)}, ${num(row.fee)},
     ${q(row.std)}, ${q(row.stdNote)}, ${q(row.memo ?? '')}, N'system', SYSDATETIME(), N'N');
END
`;

const allRows = [...rows, EXTRA];
const elements = allRows.map((r) => q(r.elem)).join(', ');

const sql = `/* ============================================================================
   送样登记表(SAMPLE_REG)· 内部检测目录 2026-11-19 版(在册复核/部署版,幂等)
   ----------------------------------------------------------------------------
   源文件:`+ '`提供系统更新版2026.11.17(1).xls`' + ` 的「内部检测目录」sheet
     (「内部检测目录 / 方法检出限和收费要求」;缺该 sheet 时回退 Sheet1)
   生成器:`+ '`tools/archive/_sample-catalog-20261119/gen-migration.mjs`' + `(可重跑再生成本脚本)

   用户口径(2026-11-17,2026-11-19 复核沿用):
     1. 旧版目录数据不需要了 ⇒ 整批换成新表内容(不是增量补几条);
     2. 「内部检出限」列改名为「标准方法检出限」(表头与新版纸样一致)。
        实现:yj_field.label 改名(数据键跟着改),物理列名 \`内部检出限\` 沿用不变 ——
        与「收费」同款(label=收费（一个样/元）,col=收费),后端 labelsToCols 按 label 认载荷键、
        查询按 label 回填,所以改名对已存单据数据零影响(它们在同一物理列里)。

   为什么要出这一版(2026-11-19):
     用户提供的新文件「(1) 版」与旧 `+ '`提供系统更新版2026.11.17.xls`' + ` 的 Sheet1
     **逐格内容完全一致**(已用 xlsx 解析逐格 diff 核实),数据本身没有第 3 代;
     本脚本 = **在册复核 / 部署版**:重跑一遍把所有幂等步骤落齐(字段改名、译名、
     55 行逐行 upsert、目录外旧项置作废、自检),让两账套对齐到同一份事实。

   附带(2026-11-19):明细页签标题「送样登记表明细」改为「内部检测目录」,
     走 yj_panel.config 的 detailTabLabel(数据驱动),不在本脚本里改 ——
     见 tools/migrate-sample-reg-detail-tab-20261119.sql。

   与旧版(20261110,44 行)的差异:
     - 新增 12 项:色度 / 高浓度银 / 总硬度(原「硬度」改名) / 吸附碘值 / 吸附亚甲基蓝 /
       水分 / 灰分 / 偏硅酸 / 磷酸盐 / 硅酸盐 / 粉体密实震动 / 强度测试仪-炭棒;
     - 删除 1 项:「硬度」(被「总硬度」取代,本脚本置 asp_cancel='Y');
     - 序号 重排(粒度 40→50、一级/二级/三级精度 41/42/43→51/52/53);
     - 检出限口径由「内部 ppm 量级」换成「标准方法 mg/L 量级」;
     - 测试周期由「半天/一天/两天」换成「N个工作日出数据，5个工作日出报告」;
     - 检测标准 补精确编号(GB/T 5750.6-2023 等),检测标准备注 逐行补全。

   取值假设(源表用合并/留空表达「同上」;逐条列在此,便于复核):
     - 测试方法空白=同上;唯一例外「色度」保持空白(上一行是 TDS笔,套用会张冠李戴);
     - 测试周期空白=同上(整表向下继承);
     - 收费逐行原样、不推断:「色度」源表未给价 ⇒ 落空(需业务补价);
     - 检测标准/检测标准备注 逐行原样,空白即空白(粉体密实震动/强度测试仪-炭棒/粒度 无国标);
     - 「高浓度银」源表未给序号 ⇒ 落 28(与其上一行「高浓度铅」同号,只为保证列表排序稳定);
     - 「外送部分」是尾行说明、源表无序号 ⇒ 落 54(列表按序号升序,保证它排在最后);
     - 「检测误差」新版源表已无此列 ⇒ 全表清空(列保留,随时可在界面补)。
   幂等:按「检测元素」逐行 upsert,可重复执行;两账套(HSDZ_MES / HSDZ_MES_TEST)都要跑。
   ============================================================================ */
SET NOCOUNT ON;

PRINT N'=== 送样登记表 · 内部检测目录 2026-11-19 版(在册复核/部署版) ===';

IF OBJECT_ID(N'dbo.qc_sample_reg', N'U') IS NULL
BEGIN
  THROW 50001, N'qc_sample_reg 不存在:请先执行 tools/migrate-sample-insp-20261115.sql', 1;
END

/* ---------- 1. 字段改名:内部检出限 → 标准方法检出限(两个面板同一数据键) ---------- */
PRINT N'[1] yj_field 把「内部检出限」改名为「标准方法检出限」(SAMPLE_REG / INSP_COMMISSION)';
UPDATE yj_field SET label = N'标准方法检出限'
 WHERE col_name = N'内部检出限'
   AND panel_code IN (N'SAMPLE_REG', N'INSP_COMMISSION');
PRINT N'    改名行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* 列注明跟着改(MS_Description),便于查阅 */
IF EXISTS (SELECT 1 FROM sys.extended_properties ep
            JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
           WHERE ep.name = N'MS_Description' AND c.name = N'内部检出限'
             AND OBJECT_NAME(ep.major_id) = N'qc_sample_reg')
  EXEC sp_updateextendedproperty N'MS_Description', N'标准方法检出限(源表「标准方法检出限」;检测目录/委托单行表显示名同)',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_sample_reg', N'COLUMN', N'内部检出限';
ELSE
  EXEC sp_addextendedproperty N'MS_Description', N'标准方法检出限(源表「标准方法检出限」;检测目录/委托单行表显示名同)',
       N'SCHEMA', N'dbo', N'TABLE', N'qc_sample_reg', N'COLUMN', N'内部检出限';

/* ---------- 2. 译名:新数据键的英文(多语言规范:新增/改名数据键必须同时给译名) ---------- */
PRINT N'[2] yj_translation 补 en 译名';
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'标准方法检出限' AND locale = N'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES
    (N'field', N'标准方法检出限', N'en', N'Standard Method Detection Limit', N'manual');

/* ---------- 3. 目录内容:整批换成 2026-11-19 版(55 行 = 54 个检测项 + 外送部分) ---------- */
PRINT N'[3] 逐行 upsert 目录内容(序号/检出限/方法/周期/收费/标准/备注)';
${allRows.map(block).join('\n')}
/* ---------- 4. 新目录里没有的旧项:置作废(不硬删,留可追溯) ---------- */
PRINT N'[4] 旧目录里已被取代/取消的项置作废';
UPDATE dbo.qc_sample_reg
   SET asp_cancel = N'Y', asp_user2 = N'system', asp_time2 = SYSDATETIME()
 WHERE ISNULL(asp_cancel, N'N') <> N'Y'
   AND 检测元素 NOT IN (${elements});
PRINT N'    作废行数 = ' + CAST(@@ROWCOUNT AS nvarchar(10));

/* ---------- 5. 自检 ---------- */
PRINT N'[5] 自检';
DECLARE @active int = (SELECT COUNT(*) FROM dbo.qc_sample_reg WHERE ISNULL(asp_cancel, N'N') <> N'Y');
PRINT N'    在册目录行数 = ' + CAST(@active AS nvarchar(10)) + N'(期望 55)';
IF @active <> 55
  THROW 50002, N'目录行数不是 55,请核对第 3/4 步', 1;

IF EXISTS (SELECT 1 FROM yj_field WHERE col_name = N'内部检出限' AND label = N'内部检出限'
            AND panel_code IN (N'SAMPLE_REG', N'INSP_COMMISSION'))
  THROW 50003, N'字段改名没落全(仍有 label=内部检出限)', 1;

IF EXISTS (SELECT 1 FROM dbo.qc_sample_reg WHERE ISNULL(asp_cancel, N'N') <> N'Y' AND 检测元素 = N'硬度')
  THROW 50004, N'旧项「硬度」未作废(应与「总硬度」并存了)', 1;

PRINT N'RESULT: PASS 送样登记表检测目录已切到 2026-11-19 版(55 行,标准方法检出限)';
`;

writeFileSync(OUT, sql, 'utf8');

// ---- 控制台摘要,便于人工核对
console.log('rows =', allRows.length);
console.log('elements =', allRows.map((r) => `${r.no || '—'}:${r.elem}`).join(' | '));
console.log('missing period =', allRows.filter((r) => !r.period && r.elem !== '外送部分').map((r) => r.elem));
console.log('missing method =', allRows.filter((r) => !r.method && r.elem !== '外送部分').map((r) => r.elem));
console.log('missing fee =', allRows.filter((r) => !r.fee && r.elem !== '外送部分').map((r) => r.elem));
console.log('missing std =', allRows.filter((r) => !r.std && r.elem !== '外送部分').map((r) => r.elem));
console.log('seqs =', allRows.map((r) => r.no || '—').join(','));
console.log('WROTE', OUT);
