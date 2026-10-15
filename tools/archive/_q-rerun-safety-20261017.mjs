/**
 * _q-rerun-safety-20261017.mjs — 未提交迁移的**重跑安全性**取证(两账套,只读),2026-10-17
 *
 * 每个脚本末尾都有一组 `@bad` 自检(失败即 RAISERROR 16 ⇒ DbSync 判 FAIL、不写 yj_schema_log)。
 * 本探针把这些自检的**判定谓词**逐条当 SELECT 跑一遍,回答:
 *   「今天(库已被后续脚本改过)再跑一次这条脚本,它的自检会不会炸?会不会把已收敛的状态改回去?」
 *
 * 用法(仓库根目录):node tools/archive/_q-rerun-safety-20261017.mjs
 * 输出:tools/archive/_q-rerun-safety-20261017.out(UTF-8)。只读。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'deploy', 'config.json'), 'utf8'));
const req = createRequire(join(ROOT, 'deploy', 'package.json'));
const mssql = req('mssql');

const C = [
  // ── 引用对象是否存在(item 3d) ─────────────────────────────────────────
  ['EXIST 表', `SELECT name FROM sys.objects WHERE type IN ('U','V') AND name IN
     (N'qc_asm_insp_head',N'qc_asm_insp_detail',N'qc_proc_insp_head',N'qc_proc_insp_detail',
      N'yj_panel',N'yj_field',N'yj_translation',N'yj_report_template',N'yj_doc_status',N'yj_form_approval')
     ORDER BY name`],
  ['EXIST 列 qc_asm_insp_detail', `SELECT name FROM sys.columns
     WHERE object_id=OBJECT_ID(N'dbo.qc_asm_insp_detail')
       AND name IN (N'检验类型',N'表区',N'检验结果',N'数量',N'实测数值',N'结果判断',N'判定')
     ORDER BY name`],
  ['EXIST 列 qc_proc_insp_detail', `SELECT name FROM sys.columns
     WHERE object_id=OBJECT_ID(N'dbo.qc_proc_insp_detail') AND name=N'产线常规功能性结果'`],

  // ── migrate-asm-insp-report-fields-20261016.sql 自检 C1/C2 ────────────
  ['RF:C2 yj_field 实测数值 in 成型/切炭/制程(需≥3)', `SELECT COUNT(*) AS n FROM yj_field
     WHERE panel_code IN (N'QC_MOLD_INSP',N'QC_CUT_INSP',N'QC_PROC_INSP') AND col_name=N'实测数值'`],
  ['RF:C2b yj_field 数量 in 成型/切炭(需≥2)', `SELECT COUNT(*) AS n FROM yj_field
     WHERE panel_code IN (N'QC_MOLD_INSP',N'QC_CUT_INSP') AND col_name=N'数量'`],
  ['RF:面板 成型/切炭 是否还在', `SELECT panel_code FROM yj_panel WHERE panel_code IN (N'QC_MOLD_INSP',N'QC_CUT_INSP')`],
  ['RF:C1 物理列 数量/实测数值 是否还在(需在)', `SELECT COL_LENGTH(N'dbo.qc_asm_insp_detail',N'数量') AS 数量,
     COL_LENGTH(N'dbo.qc_asm_insp_detail',N'实测数值') AS 实测数值`],

  // ── migrate-asm-insp-verdict-rename-20261016.sql 自检 F4(次序十连) ────
  ['VR:F4 次序十连(需 1 行)', `SELECT COUNT(*) AS n FROM yj_field a, yj_field b, yj_field c, yj_field d, yj_field e,
       yj_field f, yj_field g, yj_field h, yj_field i, yj_field j
     WHERE a.panel_code=N'QC_ASM_INSP' AND a.col_name=N'检验方法' AND b.panel_code=N'QC_ASM_INSP' AND b.col_name=N'实测数值'
       AND c.panel_code=N'QC_ASM_INSP' AND c.col_name=N'测量值1' AND d.panel_code=N'QC_ASM_INSP' AND d.col_name=N'测量值5'
       AND e.panel_code=N'QC_ASM_INSP' AND e.col_name=N'检查频率' AND f.panel_code=N'QC_ASM_INSP' AND f.col_name=N'数量'
       AND g.panel_code=N'QC_ASM_INSP' AND g.col_name=N'处理方式' AND h.panel_code=N'QC_ASM_INSP' AND h.col_name=N'备注'
       AND i.panel_code=N'QC_ASM_INSP' AND i.col_name=N'产线常规功能性结果'
       AND j.panel_code=N'QC_ASM_INSP' AND j.col_name=N'结果判断'
       AND a.seq<b.seq AND b.seq<c.seq AND c.seq<d.seq AND d.seq<e.seq AND e.seq<f.seq
       AND f.seq<g.seq AND g.seq<h.seq AND h.seq<i.seq AND i.seq<j.seq`],
  ['VR:F4 十列逐个在不在(QC_ASM_INSP)', `SELECT col_name, seq FROM yj_field WHERE panel_code=N'QC_ASM_INSP'
     AND col_name IN (N'检验方法',N'实测数值',N'测量值1',N'测量值5',N'检查频率',N'数量',N'处理方式',N'备注',
                      N'产线常规功能性结果',N'结果判断') ORDER BY seq`],

  // ── migrate-asm-insp-type-rename-20261017.sql 自检 E6/E7 ──────────────
  ['TR:E6 其它面板 表区 行数(需≥1)', `SELECT panel_code, COUNT(*) AS n FROM yj_field
     WHERE panel_code <> N'QC_ASM_INSP' AND col_name = N'表区' GROUP BY panel_code`],
  ['TR:E7 译名 检验类型 en', `SELECT locale, text FROM yj_translation
     WHERE scope=N'field' AND ref_key=N'检验类型' AND locale='en'`],

  // ── migrate-qc-proc-insp-func-result-20261017.sql 自检 ────────────────
  ['FR:QC_PROC_INSP 产线常规功能性结果 登记行数(需=1)', `SELECT COUNT(*) AS n FROM yj_field
     WHERE panel_code=N'QC_PROC_INSP' AND col_name=N'产线常规功能性结果'`],
  ['FR:译名 产线常规功能性结果 语言数(需≥9)', `SELECT COUNT(*) AS n FROM yj_translation
     WHERE scope=N'field' AND ref_key=N'产线常规功能性结果'`],
  ['FR:seq 98 撞号数(需 0)', `SELECT seq, COUNT(*) AS n FROM yj_field WHERE panel_code=N'QC_PROC_INSP'
     AND place LIKE N'%detail%' AND seq=98 GROUP BY seq HAVING COUNT(*)>1`],

  // ── migrate-qc-proc-insp-audit-trail-20261017.sql 自检 ────────────────
  ['AT:已审核无 AUDIT 留痕(需 0)', `SELECT COUNT(*) AS n FROM yj_doc_status s WHERE s.panel_code=N'QC_PROC_INSP'
     AND ISNULL(s.shr,N'')<>N'' AND ISNULL(s.canceled,N'N')<>N'Y'
     AND NOT EXISTS (SELECT 1 FROM yj_form_approval a WHERE a.panel_code=N'QC_PROC_INSP'
                     AND a.form_no=s.doc_no AND a.action=N'AUDIT')`],

  // ── migrate-asm-insp-passqty-rename-20261017.sql 自检 F1..F5 ──────────
  ['PR:F1/F2/F3 旧物绝迹检查', `SELECT COL_LENGTH(N'dbo.qc_asm_insp_head',N'合格数量（入库）') AS 旧列,
       (SELECT COUNT(*) FROM yj_field WHERE col_name=N'合格数量（入库）' OR label=N'合格数量（入库）') AS 旧登记,
       (SELECT COUNT(*) FROM yj_translation WHERE ref_key=N'合格数量（入库）') AS 旧译名,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code=N'QC_ASM_INSP' AND col_name=N'合格数量'
          AND label=N'合格数量' AND data_type=N'小数' AND place=N'header' AND seq=135
          AND required=1 AND visible=1 AND hidden=0 AND editable=1) AS 新登记行数`],
  ['PR:F3 译名 合格数量 语言数(需≥10)', `SELECT COUNT(*) AS n FROM yj_translation
     WHERE scope=N'field' AND ref_key=N'合格数量'`],
  ['PR:F4 新列注明存在', `SELECT COUNT(*) AS n FROM sys.extended_properties ep
     WHERE ep.major_id=OBJECT_ID(N'dbo.qc_asm_insp_head')
       AND ep.minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_asm_insp_head'),N'合格数量','ColumnId')
       AND ep.name=N'MS_Description'`],

  // ── migrate-asm-insp-passqty-in-20261017.sql 的**守卫方向**(重跑会加回旧列吗) ──
  ['PI:B 段守卫 COL_LENGTH(合格数量（入库）) IS NULL ?(1=重跑会 ADD 加回旧列)',
   `SELECT CASE WHEN COL_LENGTH(N'dbo.qc_asm_insp_head',N'合格数量（入库）') IS NULL THEN 1 ELSE 0 END AS will_readd_column,
       CASE WHEN NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code=N'QC_ASM_INSP' AND col_name=N'合格数量（入库）')
            THEN 1 ELSE 0 END AS will_reinsert_field,
       CASE WHEN (SELECT COUNT(*) FROM yj_translation WHERE scope=N'field' AND ref_key=N'合格数量（入库）')=0
            THEN 1 ELSE 0 END AS will_reinsert_i18n`],

  // ── config / report 模板 ──────────────────────────────────────────────
  ['CFG:fixedItems 三组关键词齐(需 1)', `SELECT CASE WHEN EXISTS (SELECT 1 FROM yj_panel WHERE panel_code=N'QC_ASM_INSP'
       AND CONVERT(nvarchar(max),config) LIKE N'%fixedItems%' AND CONVERT(nvarchar(max),config) LIKE N'%端盖两头%'
       AND CONVERT(nvarchar(max),config) LIKE N'%管身两侧%' AND CONVERT(nvarchar(max),config) LIKE N'%按照尺寸检验项目填充%'
       AND CONVERT(nvarchar(max),config) LIKE N'%按照重量检验项目填充%') THEN 1 ELSE 0 END AS ok`],
  ['CFG:QC_PROC_INSP 不得有 fixedItems(需 0)', `SELECT COUNT(*) AS n FROM yj_panel WHERE panel_code=N'QC_PROC_INSP'
     AND CONVERT(nvarchar(max),config) LIKE N'%fixedItems%'`],
  ['RPT:qc_proc_insp 模板行数与 LEN(需 1 / 16973)', `SELECT COUNT(*) AS rows_,
       (SELECT LEN(jrxml_text) FROM yj_report_template WHERE template_code=N'qc_proc_insp') AS len_,
       (SELECT COUNT(*) FROM yj_report_template WHERE template_code=N'qc_proc_insp' AND update_at IS NULL) AS null_update_at
     FROM yj_report_template WHERE template_code=N'qc_proc_insp'`],
];

async function runDb(dbName) {
  const pool = new mssql.ConnectionPool({
    server: cfg.database.server, port: cfg.database.port || 1433, database: dbName,
    user: cfg.database.user, password: cfg.database.password,
    options: { encrypt: !!cfg.database.encrypt, trustServerCertificate: true },
  });
  await pool.connect();
  const out = [`########## ${dbName} ##########`];
  for (const [title, sql] of C) {
    out.push(`\n--- ${title} ---`);
    try {
      const r = await pool.request().query(sql);
      if (!r.recordset.length) out.push('(0 行)');
      for (const row of r.recordset) out.push(JSON.stringify(row));
    } catch (e) {
      out.push(`[查询失败] ${e.message}`);
    }
  }
  await pool.close();
  return out.join('\n');
}

const chunks = [];
for (const db of ['HSDZ_MES', 'HSDZ_MES_TEST']) chunks.push(await runDb(db));
writeFileSync(join(ROOT, 'tools', 'archive', '_q-rerun-safety-20261017.out'), chunks.join('\n\n'), 'utf8');
console.log('written');
