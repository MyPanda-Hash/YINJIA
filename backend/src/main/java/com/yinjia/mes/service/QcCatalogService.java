package com.yinjia.mes.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 检验目录(QC_CATALOG)↔ 检验单(QC_INSP)↔ 检验数据记录(QC_INSP_REC)联动服务(2026-09-22 用户口径)。
 *
 * <p>口径(逐条对应需求):
 * <ol>
 *   <li><b>自动生成</b>:手工生单(暂收单→检验单)生成检验单后,按检验单明细物料
 *       <b>各建一张检验数据记录草稿</b>,并在检验目录写入对应行(幂等:同一检验单号+物料编码只有一行)。</li>
 *   <li><b>目录不可手工编辑</b>:目录行只由生单与「完成/修改」按钮驱动;检测物料类别由
 *       商品档案 {@code bs_inv.所属类别} 按物料编码带出(为空则不填,前端亦不归纳)。</li>
 *   <li><b>数量</b>=检验单明细「送检数量 + 单位」;<b>批次号</b>靠回填(先留空,回填时补齐)。</li>
 *   <li><b>检验状态</b>开局「正在检验中」;「完成」按钮校验关联的检验单与检验数据记录都已审批
 *       (检验单=已审核;检验数据记录=已归档/已审核),通过后置「已完成检验」并可同时给出「是否合格」。</li>
 *   <li><b>两个单号</b>:检验单号(查看详情/跳转)+ 检验数据记录单号(数据挂靠键 —— 批次号可能尚未回填)。</li>
 *   <li><b>「修改」按钮</b>:把「已完成检验」回弹为「正在检验中」(目录移出完成态后,才可反审核挂靠单据),
 *       并写一条修改记录(复用 yj_doc_modify_log,由既有「修改记录」按钮展示)。</li>
 *   <li><b>守卫</b>:挂靠单据反审核时若目录行已完成 → 拒绝并提示先在目录点「修改」;
 *       删除目录行时若两个挂靠单据仍在 → 拒绝并提示先删除它们。</li>
 * </ol>
 *
 * <p>依赖刻意保持极轻(JdbcTemplate + FormNoService),不反向依赖 ButtonService,
 * 以免与 ButtonService→本服务的调用形成循环依赖;挂靠单据的状态判定由 ButtonService 传入。
 */
@Service
public class QcCatalogService {

    private static final Logger log = LoggerFactory.getLogger(QcCatalogService.class);

    /** 目录面板编码 */
    public static final String CATALOG_PANEL = "QC_CATALOG";
    /** 检验数据记录面板编码 */
    public static final String REC_PANEL = "QC_INSP_REC";
    /** 检验单面板编码 */
    public static final String INSP_PANEL = "QC_INSP";
    /** 检验状态两态(与 yj_field 字典一致) */
    public static final String ST_DOING = "正在检验中";
    public static final String ST_DONE = "已完成检验";
    /** 检验报告固定项(与前端 core/panel/docDefaults.js 的 QC_INSP_REC 默认值同口径) */
    private static final String REC_DOC_CODE = "YJ-QR-96";
    private static final String REC_BASIS = "YJ-Q-30";
    private static final String REC_REVIEWER = "冯敏";
    /** 检验单号前缀(检验单面板 yj_panel.prefix) */
    private static final String INSP_PREFIX = "IJ";
    /** 检验数据记录号前缀 */
    private static final String REC_PREFIX = "JYSJ";

    private final JdbcTemplate jdbc;
    private final FormNoService formNoService;

    public QcCatalogService(JdbcTemplate jdbc, FormNoService formNoService) {
        this.jdbc = jdbc;
        this.formNoService = formNoService;
    }

    // ==================== ① 生单联动:建报告草稿 + 目录行 ====================

    /**
     * 检验单生成后调用(手工生单两包:分批生单 generateBatch / 通用生单 handle)。
     * 按明细物料建检验数据记录草稿并写目录行;幂等 —— 同一(检验单号, 物料编码)只保留一行。
     *
     * @return 本次新建/刷新的目录行数
     */
    @Transactional
    public int syncFromInspection(String inspNo, String user) {
        if (inspNo == null || inspNo.isBlank()) return 0;
        List<Map<String, Object>> rows = loadInspRows(inspNo);
        if (rows.isEmpty()) {
            log.warn("[QC目录] 检验单 {} 无明细行,跳过目录同步", inspNo);
            return 0;
        }
        String catalogNo = ensureCatalogDoc(user);
        String batchNo = str(headValue(inspNo, "批次号"));
        String inspDate = str(headValue(inspNo, "单据日期"));
        int n = 0;
        for (Map<String, Object> r : rows) {
            String invCode = str(r.get("物料编码"));
            if (invCode.isBlank()) continue;                     // 无物料编码的行不进目录(无从取类别)
            String invName = str(r.get("物料名称"));
            String qty = qtyWithUnit(r);
            String category = categoryOf(invCode);               // 商品档案 所属类别(空则不填,不归纳)
            String curBatch = str(r.get("批次号"));
            if (curBatch.isBlank()) curBatch = batchNo;          // 明细批次号为空时用检验单头(批次号可能后回填)

            Long existId = firstLong("SELECT TOP 1 id FROM qc_catalog_detail WHERE 单据编号=? AND 检验单号=? AND 物料编码=?"
                    + " AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC", catalogNo, inspNo, invCode);
            String recNo;
            if (existId != null) {
                // 已生成过:复用其检验数据记录单号(仍存活才复用,否则新建)
                String oldRec = str(firstValue("SELECT 检验数据记录单号 FROM qc_catalog_detail WHERE id=?", existId));
                recNo = recExists(oldRec) ? oldRec : createInspRecord(invName, invCode, qty, inspDate, user);
                jdbc.update("UPDATE qc_catalog_detail SET 检测物料类别=?, 物料名称=?, 数量=?, 批次号=?, 检验数据记录单号=?,"
                        + " asp_user2=?, asp_time2=GETDATE() WHERE id=?",
                        nv(category), nv(invName), nv(qty), nv(curBatch), nv(recNo), user, existId);
            } else {
                recNo = createInspRecord(invName, invCode, qty, inspDate, user);
                jdbc.update("INSERT INTO qc_catalog_detail (单据编号, 检测物料类别, 物料名称, 物料编码, 批次号, 数量,"
                        + " 检验状态, 是否合格, 检验单号, 检验数据记录单号, asp_user1, asp_time1)"
                        + " VALUES (?,?,?,?,?,?,?,NULL,?,?,?,GETDATE())",
                        catalogNo, nv(category), nv(invName), nv(invCode), nv(curBatch), nv(qty),
                        ST_DOING, inspNo, nv(recNo), user);
            }
            n++;
        }
        log.info("[QC目录] 检验单 {} → 目录 {}:同步 {} 行", inspNo, catalogNo, n);
        return n;
    }

    /** 检验单明细行(中文标签键,与前端取数口径一致) */
    private List<Map<String, Object>> loadInspRows(String inspNo) {
        return jdbc.queryForList("SELECT id, 物料编码, 物料名称, 批次号, 送检数量, 数量, 单位, 计量单位"
                + " FROM qc_insp_detail WHERE 单据编号=? AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id", inspNo);
    }

    /** 数量 = 送检数量(缺失退回 数量)+ 单位(缺失退回 计量单位) */
    private String qtyWithUnit(Map<String, Object> row) {
        Object q = row.get("送检数量");
        if (q == null) q = row.get("数量");
        String unit = str(row.get("单位"));
        if (unit.isBlank()) unit = str(row.get("计量单位"));
        if (q == null) return unit;
        String num = q instanceof Number num0 ? trimNum(num0.doubleValue()) : str(q);
        return num + unit;
    }

    private static String trimNum(double v) {
        if (Math.abs(v - Math.rint(v)) < 1e-9) return String.valueOf((long) Math.rint(v));
        return String.valueOf(Math.round(v * 10000.0) / 10000.0);
    }

    /** 检测物料类别:商品档案 bs_inv.所属类别(按存货编码);找不到/为空 → 空串(前端不归纳) */
    private String categoryOf(String invCode) {
        return str(firstValue("SELECT TOP 1 所属类别 FROM bs_inv WHERE 存货编码=? ORDER BY id", invCode));
    }

    /** 目录单:单单据面板只有一张,没有则建一张(与前端「新增」同口径) */
    private String ensureCatalogDoc(String user) {
        String no = str(firstValue("SELECT TOP 1 单据编号 FROM qc_catalog WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id"));
        if (!no.isBlank()) return no;
        String newNo = formNoService.next("JYML", user);
        jdbc.update("INSERT INTO qc_catalog (单据编号, 单据日期, 备注, asp_user1, asp_time1) VALUES (?,?,?,?,GETDATE())",
                newNo, LocalDate.now().toString(), "来料品质检验目录(由检验单生单自动维护)", user);
        mergeStatus(CATALOG_PANEL, newNo, user, true);
        return newNo;
    }

    /**
     * 建检验数据记录(检验报告):抬头带出物料/数量等,**建出来就是已保存态**(用户口径:报告数据要已经保存好的);
     * **物料批次号不在此处写** —— 批次号由采购入库单审核取号后回填,故留空,
     * 待入库后经 {@link #refreshBatchNosFromInsp()} 自动回填(用户口径:物料批次号是后面入库后自动回填的)。
     */
    private String createInspRecord(String invName, String invCode, String qty, String inspDate, String user) {
        String no = formNoService.next(REC_PREFIX, user);
        String date = LocalDate.now().toString();
        jdbc.update("INSERT INTO qc_insp_rec (单据编号, 单据日期, 物料名称, 物料编码, 物料批次, 检验日期, 来料数量,"
                + " 文件编码, 检验依据, 检验人, 表单审核人, asp_user1, asp_time1)"
                + " VALUES (?,?,?,?,NULL,?,?,?,?,?,?,?,GETDATE())",
                no, date, nv(invName), nv(invCode), nv(inspDate.isBlank() ? date : inspDate), nv(qty),
                REC_DOC_CODE, REC_BASIS, user, REC_REVIEWER, user);
        mergeStatus(REC_PANEL, no, user, true);
        return no;
    }

    /** 状态行(merger 幂等):saved=Y 表示报告建出来即已保存态;目录单同口径写 Y */
    private void mergeStatus(String panelCode, String docNo, String user, boolean saved) {
        jdbc.update("MERGE yj_doc_status AS t USING (VALUES (?,?)) AS s(panel_code, doc_no)"
                + " ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no"
                + " WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, canceled, saved, update_at) VALUES (?, ?, 'N', ?, GETDATE());",
                panelCode, docNo, panelCode, docNo, saved ? "Y" : "N");
    }

    private boolean recExists(String recNo) {
        if (recNo == null || recNo.isBlank()) return false;
        Integer c = jdbc.queryForObject("SELECT COUNT(*) FROM qc_insp_rec WHERE 单据编号=? AND ISNULL(asp_cancel,'N')<>'Y'",
                Integer.class, recNo);
        return c != null && c > 0;
    }

    // ==================== ② 完成 / 修改(按钮) ====================

    /**
     * 「完成」:校验挂靠单据已审批 → 置「已完成检验」并给出是否合格。
     *
     * @param inspStatus 检验单状态(由 ButtonService 按同一状态机推导后传入)
     * @param recStatus  检验数据记录状态(同上;已归档/已审核都算已审批)
     * @param qualified  是否合格(合格/不合格,可空 —— 允许先完成、后补判定)
     */
    @Transactional
    public Map<String, Object> completeRow(Long rowId, String inspStatus, String recStatus, String qualified, String user) {
        Map<String, Object> row = rowOf(rowId);
        String inspNo = str(row.get("检验单号")), recNo = str(row.get("检验数据记录单号"));
        if (inspNo.isBlank()) throw new IllegalStateException("该目录行没有关联检验单,无法完成");
        if (!"已审核".equals(inspStatus)) {
            throw new IllegalStateException("关联检验单 " + inspNo + " 尚未审批(当前:" + inspStatus + "),请先完成检验单审核");
        }
        if (recNo.isBlank()) throw new IllegalStateException("该目录行没有关联检验数据记录,无法完成");
        if (!("已归档".equals(recStatus) || "已审核".equals(recStatus))) {
            throw new IllegalStateException("关联检验数据记录 " + recNo + " 尚未审批(当前:" + recStatus + "),请先完成报告审批/归档");
        }
        String q = str(qualified);
        jdbc.update("UPDATE qc_catalog_detail SET 检验状态=?, 是否合格=?, asp_user2=?, asp_time2=GETDATE() WHERE id=?",
                ST_DONE, q.isBlank() ? null : q, user, rowId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", rowId);
        out.put("检验状态", ST_DONE);
        out.put("是否合格", q);
        out.put("检验单号", inspNo);
        out.put("检验数据记录单号", recNo);
        return out;
    }

    /**
     * 「修改」:把「已完成检验」回弹为「正在检验中」,并写一条修改记录(由「修改记录」按钮展示)。
     * 目的:已完成态下不允许改动挂靠单据,必须先在此取消完成。
     */
    @Transactional
    public Map<String, Object> reopenRow(String docNo, Long rowId, String user) {
        Map<String, Object> row = rowOf(rowId);
        String cur = str(row.get("检验状态"));
        if (!ST_DONE.equals(cur)) {
            throw new IllegalStateException("该目录行当前不是「已完成检验」(当前:" + (cur.isBlank() ? "未填" : cur) + "),无需取消完成");
        }
        jdbc.update("UPDATE qc_catalog_detail SET 检验状态=?, asp_user2=?, asp_time2=GETDATE() WHERE id=?", ST_DOING, user, rowId);
        String tag = str(row.get("物料名称")) + " / " + str(row.get("批次号"));
        String changes = "[{\"kind\":\"修改\",\"label\":\"检验状态\",\"old\":\"" + esc(ST_DONE)
                + "\",\"new\":\"" + esc(ST_DOING) + "\"}"
                + ",{\"kind\":\"修改\",\"label\":\"记录\",\"old\":\"" + esc(tag.trim())
                + "\",\"new\":\"取消完成,可反审核挂靠单据\"}]";
        String meta = "{\"changedRows\":1,\"changedSamples\":[\"" + esc(tag.trim()) + "\"]}";
        jdbc.update("INSERT INTO yj_doc_modify_log (panel_code, doc_no, apply_by, apply_at, approve_by, approve_at,"
                + " changes, change_meta, rearchive_by, rearchive_at)"
                + " VALUES (?,?,?,GETDATE(),?,GETDATE(),?,?,?,GETDATE())",
                CATALOG_PANEL, docNo, user, user, changes, meta, user);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", rowId);
        out.put("检验状态", ST_DOING);
        out.put("已写修改记录", true);
        return out;
    }

    // ==================== ③ 守卫 ====================

    /**
     * 反审核守卫:挂靠单据(检验单 / 检验数据记录)在检验目录中已「已完成检验」时拒绝反审核。
     * 用户口径:已完成的数据需要先在检验目录点「修改」取消,才能反审核改动挂靠单据。
     */
    public void assertLinkedRowNotCompleted(String panelCode, String docNo) {
        if (docNo == null || docNo.isBlank()) return;
        String col = INSP_PANEL.equals(panelCode) ? "检验单号" : (REC_PANEL.equals(panelCode) ? "检验数据记录单号" : null);
        if (col == null) return;
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT TOP 1 物料名称, 批次号 FROM qc_catalog_detail"
                + " WHERE " + col + "=? AND 检验状态=? AND ISNULL(asp_cancel,'N')<>'Y'", docNo, ST_DONE);
        if (!rows.isEmpty()) {
            Map<String, Object> r = rows.get(0);
            throw new IllegalStateException("该单据在「检验目录」中已标记「" + ST_DONE + "」(" + str(r.get("物料名称"))
                    + " / " + str(r.get("批次号")) + "),请先在检验目录点「修改」取消完成,再反审核");
        }
    }

    /**
     * 删除守卫(单向,用户口径):删除目录行时,若挂靠的检验单 / 检验数据记录还在 → 拒绝,
     * 提示先删除这两个挂靠单据。
     */
    public void assertNoLinkedDocs(Long rowId) {
        Map<String, Object> row = rowOf(rowId);
        List<String> alive = new ArrayList<>();
        String inspNo = str(row.get("检验单号")), recNo = str(row.get("检验数据记录单号"));
        if (!inspNo.isBlank() && countAlive("qc_insp", inspNo) > 0) alive.add("检验单 " + inspNo);
        if (!recNo.isBlank() && countAlive("qc_insp_rec", recNo) > 0) alive.add("检验数据记录 " + recNo);
        if (!alive.isEmpty()) {
            throw new IllegalStateException("该目录行仍挂靠 " + String.join("、", alive) + ",请先删除这两个挂靠单据后再删除目录记录");
        }
    }

    /** 目录行软删(守卫通过后调用) */
    @Transactional
    public int deleteRow(Long rowId, String user) {
        assertNoLinkedDocs(rowId);
        return jdbc.update("UPDATE qc_catalog_detail SET asp_cancel='Y', asp_user2=?, asp_time2=GETDATE() WHERE id=?",
                user, rowId);
    }

    /** 批次号回填:把检验单(或报告)上的批次号补进对应目录行(目录行批次号可能尚未回填) */
    @Transactional
    public int backfillBatchNo(String paneCode, String docNo, String batchNo) {
        if (docNo == null || docNo.isBlank() || batchNo == null || batchNo.isBlank()) return 0;
        String col = INSP_PANEL.equals(paneCode) ? "检验单号" : (REC_PANEL.equals(paneCode) ? "检验数据记录单号" : null);
        if (col == null) return 0;
        return jdbc.update("UPDATE qc_catalog_detail SET 批次号=?, asp_user2='system', asp_time2=GETDATE()"
                + " WHERE " + col + "=? AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(批次号,N'')=''", batchNo, docNo);
    }

    /**
     * 批次号回填收尾(采购入库单审核取号回填全链之后调用):
     * 目录行批次号为空、而挂靠检验单已有批次号时补齐 —— 用户口径「批次号是通过回填得到的」。
     */
    @Transactional
    public int refreshBatchNosFromInsp() {
        // ① 目录行:挂靠检验单已有批次号时补齐空批次号
        int n = jdbc.update("UPDATE d SET d.批次号 = h.批次号, d.asp_user2 = 'system', d.asp_time2 = GETDATE()"
                + " FROM qc_catalog_detail d INNER JOIN qc_insp h ON h.单据编号 = d.检验单号"
                + " WHERE ISNULL(d.asp_cancel,'N') <> 'Y' AND ISNULL(d.批次号, N'') = '' AND ISNULL(h.批次号, N'') <> ''");
        // ② 检验数据记录(检验报告):物料批次号同样靠入库回填 —— 报告建单时留空,此处按挂靠关系自动补上
        n += jdbc.update("UPDATE r SET r.物料批次 = h.批次号, r.asp_user2 = 'system', r.asp_time2 = GETDATE()"
                + " FROM qc_insp_rec r"
                + " INNER JOIN qc_catalog_detail d ON d.检验数据记录单号 = r.单据编号 AND ISNULL(d.asp_cancel,'N') <> 'Y'"
                + " INNER JOIN qc_insp h ON h.单据编号 = d.检验单号"
                + " WHERE ISNULL(r.asp_cancel,'N') <> 'Y' AND ISNULL(r.物料批次, N'') = '' AND ISNULL(h.批次号, N'') <> ''");
        return n;
    }

    // ==================== 小工具 ====================

    private Map<String, Object> rowOf(Long rowId) {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT id, 检测物料类别, 物料名称, 物料编码, 批次号, 数量,"
                + " 检验状态, 是否合格, 检验单号, 检验数据记录单号 FROM qc_catalog_detail WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'", rowId);
        if (rows.isEmpty()) throw new IllegalStateException("检验目录记录不存在或已删除:" + rowId);
        return rows.get(0);
    }

    private int countAlive(String table, String docNo) {
        Integer c = jdbc.queryForObject("SELECT COUNT(*) FROM " + table + " WHERE 单据编号=? AND ISNULL(asp_cancel,'N')<>'Y'",
                Integer.class, docNo);
        return c == null ? 0 : c;
    }

    private Object firstValue(String sql, Object... args) {
        List<Map<String, Object>> rows = jdbc.queryForList(sql, args);
        return rows.isEmpty() ? null : rows.get(0).values().iterator().next();
    }

    private Long firstLong(String sql, Object... args) {
        Object v = firstValue(sql, args);
        if (v == null) return null;
        return v instanceof Number n ? n.longValue() : Long.valueOf(String.valueOf(v));
    }

    private Object headValue(String inspNo, String col) {
        return firstValue("SELECT TOP 1 " + col + " FROM qc_insp WHERE 单据编号=?", inspNo);
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    /** null/空串统一写 NULL(避免把空串写进列) */
    private static String nv(String s) {
        return s == null || s.isBlank() ? null : s;
    }

    private static String esc(String s) {
        return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
