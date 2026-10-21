import java.math.BigDecimal;
import java.sql.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 来料检验链数据重建（2026-10-21 用户口径）。
 *
 * 做的事：
 *   1) 备份并彻底删除现有 来料检验单 / 检验目录 / 检验数据记录（含其自动生成的退料单、草稿入库单、
 *      状态行、流转占用、修改记录）。
 *   2) 从送料暂收单 QC_RECV 逐行按商品档案 bs_inv.来料检验='是' 重建：
 *      来料检验单 + 检验目录 + 检验数据记录。
 *   3) 所有日期取送料暂收单的单据日期；批次号/批次键继承暂收单；审核人=冯敏。
 *   4) 检验数据记录按正常项目填写（外观/尺寸/克重/材质/检验数据1），每批留一项不合格，
 *      因此检验单审核只产生“暂收退料单”，不产生采购入库单（用户口径：只需要退料单）。
 *
 * 用法（tools 目录）：
 *   java -cp lib/mssql-jdbc.jar archive/_qc-cleanup-probe-20261021/QcRegen.java           # 只打印计划
 *   java -cp lib/mssql-jdbc.jar archive/_qc-cleanup-probe-20261021/QcRegen.java --apply   # 执行
 *
 * 说明：这是数据修复/造数脚本，不是迁移脚本；执行后不写 yj_schema_log。
 */
public class QcRegen {

    static final String URL = "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=15";
    static final String USER = "yinjia";
    static final String PASS = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");

    static final String REVIEWER = "冯敏";
    static final String NY = "2026-10";
    static final String BATCH_DATE = "2026-10-21";

    static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    record Line(String recvNo, String recvDate, String salesman,
                String supplierCode, String supplier, String warehouse, String poNo,
                String headBatch, Integer batchId, String inspBatch,
                long lineId, String materialCode, String materialName, String spec, String desc,
                BigDecimal qty, BigDecimal price, String unit, String orderLine, String lineBatch,
                String remark, String category) {}

    public static void main(String[] args) throws Exception {
        boolean apply = Arrays.asList(args).contains("--apply");
        try (Connection c = DriverManager.getConnection(URL, USER, PASS)) {
            c.setAutoCommit(false);
            try {
                run(c, apply);
                if (apply) c.commit(); else c.rollback();
            } catch (Exception e) {
                c.rollback();
                throw e;
            }
        }
    }

    static void run(Connection c, boolean apply) throws Exception {
        List<Line> lines = loadSourceLines(c);
        if (lines.isEmpty()) throw new IllegalStateException("没有可生成检验单的送料暂收明细（来料检验=是、未作废）");

        Map<String, List<Line>> byDoc = new LinkedHashMap<>();
        for (Line l : lines) byDoc.computeIfAbsent(l.recvNo, k -> new ArrayList<>()).add(l);

        System.out.println("[source] 暂收单 " + byDoc.size() + " 张 / 明细 " + lines.size() + " 行（已排除已作废暂收单）");
        for (Map.Entry<String, List<Line>> e : byDoc.entrySet()) {
            Line f = e.getValue().get(0);
            System.out.printf("  %s  日期=%s  供应商=%s  批次=%s  行=%d%n",
                    e.getKey(), f.recvDate, f.supplier, f.headBatch, e.getValue().size());
        }

        List<String> oldInsp = strList(c, "SELECT 单据编号 FROM qc_insp ORDER BY 单据编号");
        List<String> oldReturns = strList(c, "SELECT 单据编号 FROM qc_return ORDER BY 单据编号");
        List<String> oldRecs = strList(c, "SELECT 单据编号 FROM qc_insp_rec ORDER BY 单据编号");
        List<String> oldCatalog = strList(c, "SELECT 单据编号 FROM qc_catalog ORDER BY 单据编号");
        List<String> oldPi = strList(c,
                "SELECT DISTINCT l.target_form_no FROM form_flow_link l"
                        + " JOIN yj_doc_status s ON s.panel_code='PURCHASE_IN' AND s.doc_no=l.target_form_no"
                        + " WHERE l.source_panel_code='QC_INSP' AND l.target_panel_code='PURCHASE_IN'"
                        + " AND l.link_status='ACTIVE' AND s.shr IS NULL ORDER BY l.target_form_no");
        System.out.println("[delete] QC_INSP=" + oldInsp.size() + " QC_RETURN=" + oldReturns.size()
                + " QC_INSP_REC=" + oldRecs.size() + " QC_CATALOG=" + oldCatalog.size()
                + " 自动草稿采购入库=" + oldPi.size() + (oldPi.isEmpty() ? "" : " " + oldPi));

        if (!apply) {
            System.out.println("[dry-run] 未执行删除/重建。加 --apply 执行。");
            return;
        }

        backup(c, oldPi);
        deleteOld(c, oldPi);

        // 单号基准：号池 + 业务表的最大流水
        int ijSeq = nextSeq(c, "IJ", "qc_insp", "单据编号");
        int jysjSeq = nextSeq(c, "JYSJ", "qc_insp_rec", "单据编号");
        int thSeq = nextSeq(c, "TH", "qc_return", "单据编号");
        int jymlSeq = nextSeq(c, "JYML", "qc_catalog", "单据编号");

        String catalogNo = "JYML-" + NY + "-" + String.format("%04d", jymlSeq++);
        reserveNo(c, "JYML", catalogNo);
        String catalogDate = byDoc.values().stream()
                .flatMap(List::stream).map(Line::recvDate).max(String::compareTo).orElse(BATCH_DATE);
        insertCatalog(c, catalogNo, catalogDate);

        int madeInsp = 0, madeDetail = 0, madeRec = 0, madeRecDetail = 0, madeReturn = 0, madeReturnDetail = 0;
        for (Map.Entry<String, List<Line>> e : byDoc.entrySet()) {
            String inspNo = "IJ-" + NY + "-" + String.format("%04d", ijSeq++);
            reserveNo(c, "IJ", inspNo);
            List<Line> docLines = e.getValue();
            Line h = docLines.get(0);
            String date = h.recvDate;
            BigDecimal totalQty = docLines.stream().map(Line::qty).reduce(BigDecimal.ZERO, BigDecimal::add);
            String failReason = failReason(h.category);

            insertInspHead(c, inspNo, h, date, totalQty);
            List<Long> inspDetailIds = new ArrayList<>();
            List<String> recNos = new ArrayList<>();
            for (Line l : docLines) {
                long detailId = insertInspDetail(c, inspNo, l, date, failReason);
                inspDetailIds.add(detailId);
                String recNo = "JYSJ-" + NY + "-" + String.format("%04d", jysjSeq++);
                reserveNo(c, "JYSJ", recNo);
                recNos.add(recNo);
                insertRecord(c, recNo, inspNo, l, date, failReason);
                insertDocStatus(c, "QC_INSP_REC", recNo, REVIEWER, date + " 12:00:00");
                insertRecordDetail(c, recNo, l.category, date);
                insertCatalogDetail(c, catalogNo, inspNo, recNo, l, date);
                madeRec++; madeRecDetail += recordItems(l.category).size(); madeDetail++;
            }
            insertDocStatus(c, "QC_INSP", inspNo, REVIEWER, date + " 12:00:00");

            String thNo = "TH-" + NY + "-" + String.format("%04d", thSeq++);
            reserveNo(c, "TH", thNo);
            insertReturnHead(c, thNo, h, inspNo, date, totalQty);
            for (int i = 0; i < docLines.size(); i++) {
                Line l = docLines.get(i);
                long retDetailId = insertReturnDetail(c, thNo, l, date, failReason);
                link(c, "QC_INSP", inspNo, inspNo + "#" + inspDetailIds.get(i),
                        "QC_RETURN", thNo, thNo + "#" + retDetailId, l.materialCode,
                        l.qty, l.qty, l.inspBatch, l.batchId);
                madeReturnDetail++;
            }
            insertDocStatus(c, "QC_RETURN", thNo, null, null);
            madeInsp++; madeReturn++;

            for (int i = 0; i < docLines.size(); i++) {
                Line l = docLines.get(i);
                link(c, "QC_RECV", l.recvNo, l.recvNo + "#" + l.lineId,
                        "QC_INSP", inspNo, inspNo + "#" + inspDetailIds.get(i), l.materialCode,
                        l.qty, l.qty, l.inspBatch, l.batchId);
            }
        }
        insertDocStatus(c, "QC_CATALOG", catalogNo, REVIEWER, catalogDate + " 12:00:00");

        System.out.println("[done] 检验单=" + madeInsp + " 明细=" + madeDetail
                + " 数据记录=" + madeRec + " 记录明细=" + madeRecDetail
                + " 退料单=" + madeReturn + " 退料明细=" + madeReturnDetail
                + " 目录=" + catalogNo + "(" + madeDetail + "行)");
        verify(c, madeInsp, madeDetail, madeRec, madeReturn);
    }

    // ==================== 读取来源 ====================

    static List<Line> loadSourceLines(Connection c) throws SQLException {
        String sql = """
                SELECT h.单据编号 recv_no, h.单据日期 recv_date, h.业务员, h.供应商代码, h.供应商,
                       h.仓库, h.采购订单号, h.批次号 head_batch, h.批次键,
                       d.id line_id, d.物料编码, d.物料名称, d.规格型号, d.物料描述, d.数量, d.单价,
                       d.计量单位, d.采购订单行号, d.批次号 line_batch, d.备注,
                       i.所属类别,
                       ISNULL(ds.canceled,'N') canceled
                FROM sl_recv h
                JOIN sl_recv_detail d ON d.单据编号=h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y'
                JOIN bs_inv i ON LTRIM(RTRIM(i.存货编码))=LTRIM(RTRIM(d.物料编码))
                LEFT JOIN yj_doc_status ds ON ds.panel_code='QC_RECV' AND ds.doc_no=h.单据编号
                WHERE LTRIM(RTRIM(i.来料检验))=N'是' AND ISNULL(ds.canceled,'N')<>'Y'
                ORDER BY h.单据日期, h.单据编号, d.id
                """;
        List<Line> out = new ArrayList<>();
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                String date = normDate(rs.getString("recv_date"));
                String headBatch = nz(rs.getString("head_batch"));
                String lineBatch = nz(rs.getString("line_batch"));
                String batch = !lineBatch.isEmpty() ? lineBatch : headBatch;
                out.add(new Line(rs.getString("recv_no"), date, rs.getString("业务员"),
                        rs.getString("供应商代码"), rs.getString("供应商"), rs.getString("仓库"),
                        rs.getString("采购订单号"), headBatch, intObj(rs.getObject("批次键")), batch,
                        rs.getLong("line_id"), rs.getString("物料编码"), rs.getString("物料名称"),
                        rs.getString("规格型号"), rs.getString("物料描述"),
                        dec(rs.getBigDecimal("数量")), dec(rs.getBigDecimal("单价")),
                        nz(rs.getString("计量单位")), rs.getString("采购订单行号"), batch,
                        rs.getString("备注"), nz(rs.getString("所属类别"))));
            }
        }
        return out;
    }

    // ==================== 备份/删除 ====================

    static void backup(Connection c, List<String> oldPi) throws SQLException {
        String suffix = "_bak_qcregen_20261021";
        backupTable(c, suffix + "_qc_insp", "SELECT * FROM qc_insp");
        backupTable(c, suffix + "_qc_insp_detail", "SELECT * FROM qc_insp_detail");
        backupTable(c, suffix + "_qc_catalog", "SELECT * FROM qc_catalog");
        backupTable(c, suffix + "_qc_catalog_detail", "SELECT * FROM qc_catalog_detail");
        backupTable(c, suffix + "_qc_insp_rec", "SELECT * FROM qc_insp_rec");
        backupTable(c, suffix + "_qc_insp_rec_detail", "SELECT * FROM qc_insp_rec_detail");
        backupTable(c, suffix + "_qc_return", "SELECT * FROM qc_return");
        backupTable(c, suffix + "_qc_return_detail", "SELECT * FROM qc_return_detail");
        backupTable(c, suffix + "_yj_doc_status",
                "SELECT * FROM yj_doc_status WHERE panel_code IN ('QC_INSP','QC_CATALOG','QC_INSP_REC','QC_RETURN')");
        backupTable(c, suffix + "_form_flow_link",
                "SELECT * FROM form_flow_link WHERE source_panel_code='QC_INSP'"
                        + " OR (source_panel_code='QC_RECV' AND target_panel_code='QC_INSP')");
        if (!oldPi.isEmpty()) {
            String in = inList(oldPi);
            backupTable(c, suffix + "_bd_purchase_in",
                    "SELECT * FROM bd_purchase_in WHERE 单据编号 IN (" + in + ")");
            backupTable(c, suffix + "_bl_purchase_in",
                    "SELECT * FROM bl_purchase_in WHERE 单据编号 IN (" + in + ")");
        }
    }

    static void backupTable(Connection c, String base, String select) throws SQLException {
        String name = base;
        for (int i = 2; tableExists(c, name); i++) name = base + "_" + i;
        try (Statement st = c.createStatement()) {
            st.executeUpdate("SELECT * INTO " + name + " FROM (" + select + ") x");
        }
        System.out.println("[backup] " + name);
    }

    static void deleteOld(Connection c, List<String> oldPi) throws SQLException {
        List<String> retNos = strList(c, "SELECT 单据编号 FROM qc_return");
        String retIn = retNos.isEmpty() ? null : inList(retNos);
        String piIn = oldPi.isEmpty() ? null : inList(oldPi);

        StringBuilder delLink = new StringBuilder(
                "DELETE FROM form_flow_link WHERE source_panel_code='QC_INSP'"
                        + " OR (source_panel_code='QC_RECV' AND target_panel_code='QC_INSP')");
        if (retIn != null) delLink.append(" OR (source_panel_code='QC_RETURN' AND source_form_no IN (").append(retIn).append("))");
        if (piIn != null) delLink.append(" OR (target_panel_code='PURCHASE_IN' AND target_form_no IN (").append(piIn).append("))");
        exec(c, delLink.toString());
        if (piIn != null) {
            exec(c, "DELETE FROM bl_purchase_in WHERE 单据编号 IN (" + piIn + ")");
            exec(c, "DELETE FROM bd_purchase_in WHERE 单据编号 IN (" + piIn + ")");
        }
        exec(c, "DELETE FROM qc_insp_rec_detail");
        exec(c, "DELETE FROM qc_insp_rec");
        exec(c, "DELETE FROM qc_catalog_detail");
        exec(c, "DELETE FROM qc_catalog");
        exec(c, "DELETE FROM qc_return_detail");
        exec(c, "DELETE FROM qc_return");
        exec(c, "DELETE FROM qc_insp_detail");
        exec(c, "DELETE FROM qc_insp");
        exec(c, "DELETE FROM yj_doc_status WHERE panel_code IN ('QC_INSP','QC_CATALOG','QC_INSP_REC','QC_RETURN')");
        if (piIn != null) exec(c, "DELETE FROM yj_doc_status WHERE panel_code='PURCHASE_IN' AND doc_no IN (" + piIn + ")");
        exec(c, "DELETE FROM yj_doc_modify_log WHERE panel_code IN ('QC_INSP','QC_CATALOG','QC_INSP_REC','QC_RETURN')");
    }

    // ==================== 生成 ====================

    static long insertInspHead(Connection c, String no, Line h, String date, BigDecimal qty) throws SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("单据编号", no);
        m.put("单据日期", date);
        m.put("业务员", h.salesman);
        m.put("供应商代码", h.supplierCode);
        m.put("供应商", h.supplier);
        m.put("数量", qty);
        m.put("备注", "来料检验不合格，整批退回供应商。");
        m.put("单据状态", "已审核");
        m.put("审核人", REVIEWER);
        m.put("审核时间", date + " 12:00:00");
        m.put("检验员", REVIEWER);
        m.put("采购订单号", h.poNo);
        m.put("批次号", h.inspBatch);
        m.put("执行标准", "GB/T 2828.1-2012");
        m.put("检验类型", "抽检");
        m.put("批次键", h.batchId);
        m.put("暂收单号", h.recvNo);
        m.put("检验日期", date);
        m.put("检验方案", "正常检验一次抽样(GB/T 2828.1)");
        m.put("总结论", "不合格");
        m.put("asp_user1", REVIEWER);
        m.put("asp_time1", timestamp(date));
        m.put("asp_user2", REVIEWER);
        m.put("asp_time2", timestamp(date));
        return insertRow(c, "qc_insp", m);
    }

    static long insertInspDetail(Connection c, String no, Line l, String date, String failReason) throws SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("单据编号", no);
        m.put("物料编码", l.materialCode);
        m.put("物料名称", l.materialName);
        m.put("物料描述", l.desc);
        m.put("数量", l.qty);
        m.put("日期", date);
        m.put("备注", joinRemark(l.remark, failReason));
        m.put("合格数量", BigDecimal.ZERO);
        m.put("不良数量", l.qty);
        m.put("仓库代码", l.warehouse);
        m.put("抽样方案", "正常检验一次抽样(GB/T 2828.1)");
        m.put("品质复核人", REVIEWER);
        m.put("品质复核时间", date + " 12:00:00");
        m.put("业务员", l.salesman);
        m.put("asp_user1", REVIEWER);
        m.put("asp_time1", timestamp(date));
        m.put("asp_user2", REVIEWER);
        m.put("asp_time2", timestamp(date));
        m.put("计量单位", l.unit);
        m.put("单价", l.price);
        m.put("批号", l.inspBatch);
        m.put("送检数量", l.qty);
        m.put("采购订单行号", l.orderLine);
        m.put("批次号", l.inspBatch);
        m.put("报废数量", BigDecimal.ZERO);
        m.put("损耗", BigDecimal.ZERO);
        m.put("损耗率", BigDecimal.ZERO);
        m.put("特采", 0);
        m.put("单位", l.unit);
        m.put("规格型号", l.spec);
        m.put("不合格数量", l.qty);
        m.put("处置方式", "退货");
        return insertRow(c, "qc_insp_detail", m);
    }

    static void insertRecord(Connection c, String recNo, String inspNo, Line l, String date, String failReason) throws SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("单据编号", recNo);
        m.put("单据日期", date);
        m.put("物料名称", l.materialName);
        m.put("物料编码", l.materialCode);
        m.put("物料批次", l.inspBatch);
        m.put("检验日期", date);
        m.put("来料日期", date);
        m.put("来料数量", qtyText(l.qty) + l.unit);
        m.put("文件编码", "YJ-QR-96");
        m.put("检验依据", "YJ-Q-30");
        m.put("检验结论", "不合格");
        m.put("处理意见", "整批退货，通知供应商整改。");
        m.put("检验人", REVIEWER);
        m.put("表单审核人", REVIEWER);
        m.put("备注", failReason);
        m.put("asp_user1", REVIEWER);
        m.put("asp_time1", timestamp(date));
        m.put("asp_user2", REVIEWER);
        m.put("asp_time2", timestamp(date));
        m.put("计量单位", l.unit);
        m.put("来料检验单号", inspNo);
        insertRow(c, "qc_insp_rec", m);
    }

    static void insertRecordDetail(Connection c, String recNo, String category, String date) throws SQLException {
        for (String[] row : recordItems(category)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("单据编号", recNo);
            m.put("检验项", row[0]);
            m.put("检测标准", row[1]);
            m.put("检测结果", row[2]);
            m.put("单项判定", row[3]);
            m.put("asp_user1", REVIEWER);
            m.put("asp_time1", timestamp(date));
            m.put("asp_user2", REVIEWER);
            m.put("asp_time2", timestamp(date));
            insertRow(c, "qc_insp_rec_detail", m);
        }
    }

    static void insertCatalog(Connection c, String no, String date) throws SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("单据编号", no);
        m.put("单据日期", date);
        m.put("备注", "来料品质检验目录（2026-10-21 由送料暂收单按来料检验流程重新生成）");
        m.put("asp_user1", REVIEWER);
        m.put("asp_time1", timestamp(date));
        m.put("asp_user2", REVIEWER);
        m.put("asp_time2", timestamp(date));
        insertRow(c, "qc_catalog", m);
    }

    static void insertCatalogDetail(Connection c, String catalogNo, String inspNo, String recNo, Line l, String date) throws SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("单据编号", catalogNo);
        m.put("检测物料类别", l.category);
        m.put("物料名称", l.materialName);
        m.put("物料编码", l.materialCode);
        m.put("批次号", l.inspBatch);
        m.put("数量", qtyText(l.qty));
        m.put("计量单位", l.unit);
        m.put("检验状态", "已完成检验");
        m.put("是否合格", "不合格");
        m.put("检验单号", inspNo);
        m.put("检验数据记录单号", recNo);
        m.put("asp_user1", REVIEWER);
        m.put("asp_time1", timestamp(date));
        m.put("asp_user2", REVIEWER);
        m.put("asp_time2", timestamp(date));
        insertRow(c, "qc_catalog_detail", m);
    }

    static long insertReturnHead(Connection c, String no, Line h, String inspNo, String date, BigDecimal qty) throws SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("单据编号", no);
        m.put("单据日期", date);
        m.put("业务员", h.salesman);
        m.put("供应商代码", h.supplierCode);
        m.put("供应商", h.supplier);
        m.put("数量", qty);
        m.put("备注", "来料检验不合格，整批退回供应商。");
        m.put("单据状态", "草稿");
        m.put("检验单号", inspNo);
        m.put("采购订单号", h.poNo);
        m.put("批次号", h.headBatch);
        m.put("退货类型", "退供应商");
        m.put("退货原因", "来料检验不合格");
        m.put("经手人", REVIEWER);
        m.put("仓库", h.warehouse);
        m.put("asp_user1", REVIEWER);
        m.put("asp_time1", timestamp(date));
        m.put("asp_user2", REVIEWER);
        m.put("asp_time2", timestamp(date));
        return insertRow(c, "qc_return", m);
    }

    static long insertReturnDetail(Connection c, String no, Line l, String date, String failReason) throws SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("单据编号", no);
        m.put("物料编码", l.materialCode);
        m.put("物料名称", l.materialName);
        m.put("物料描述", l.desc);
        m.put("退货数量", l.qty);
        m.put("送检数量", l.qty);
        m.put("日期", date);
        m.put("供应商", l.supplier);
        m.put("单价", l.price);
        m.put("金额", l.price == null ? null : l.price.multiply(l.qty));
        m.put("备注", l.remark);
        m.put("asp_user1", REVIEWER);
        m.put("asp_time1", timestamp(date));
        m.put("asp_user2", REVIEWER);
        m.put("asp_time2", timestamp(date));
        m.put("采购订单行号", l.orderLine);
        m.put("计量单位", l.unit);
        m.put("批次号", l.inspBatch);
        m.put("不良原因", failReason);
        m.put("报废数量", BigDecimal.ZERO);
        m.put("剩余数量", BigDecimal.ZERO);
        m.put("规格型号", l.spec);
        return insertRow(c, "qc_return_detail", m);
    }

    static void link(Connection c, String srcPanel, String srcNo, String srcLine,
                     String tgtPanel, String tgtNo, String tgtLine, String invCode,
                     BigDecimal sourceQty, BigDecimal linkedQty, String batchNo, Integer batchId) throws SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("source_panel_code", srcPanel);
        m.put("source_form_no", srcNo);
        m.put("source_line_key", srcLine);
        m.put("target_panel_code", tgtPanel);
        m.put("target_form_no", tgtNo);
        m.put("target_line_key", tgtLine);
        m.put("inventory_code", invCode);
        m.put("source_quantity", sourceQty);
        m.put("linked_quantity", linkedQty);
        m.put("link_status", "ACTIVE");
        m.put("create_by", REVIEWER);
        m.put("create_time", new Timestamp(System.currentTimeMillis()));
        m.put("batch_no", batchNo);
        m.put("batch_id", batchId);
        insertRow(c, "form_flow_link", m);
    }

    static void insertDocStatus(Connection c, String panel, String no, String reviewer, String auditTime) throws SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("panel_code", panel);
        m.put("doc_no", no);
        m.put("shr", reviewer);
        m.put("shsj", auditTime == null ? null : Timestamp.valueOf(LocalDateTime.parse(auditTime, TS)));
        m.put("canceled", "N");
        m.put("saved", "Y");
        m.put("archived", "N");
        m.put("update_at", new Timestamp(System.currentTimeMillis()));
        insertRow(c, "yj_doc_status", m);
    }

    static List<String[]> recordItems(String category) {
        if ("炭粉".equals(category)) {
            return List.of(
                    new String[]{"外观", "色泽均匀，无杂质、无结块", "色泽均匀，无杂质", "合格"},
                    new String[]{"尺寸", "符合规格型号及封样要求", "符合要求", "合格"},
                    new String[]{"克重", "标称值±3%", "符合", "合格"},
                    new String[]{"材质", "与封样一致", "与封样一致", "合格"},
                    new String[]{"检验数据1", "水分≤0.5%", "0.72%", "不合格"});
        }
        if ("原料制备车间".equals(category)) {
            return List.of(
                    new String[]{"外观", "白色结晶，无可见杂质", "白色结晶，无可见杂质", "合格"},
                    new String[]{"颜色（白/黑）", "白色", "白色", "合格"},
                    new String[]{"材质", "与封样一致", "与封样一致", "合格"},
                    new String[]{"检验数据1", "含量≥98.0%", "96.8%", "不合格"});
        }
        return List.of(
                new String[]{"外观", "表面平整，无破损、无脏污", "表面平整，无破损", "合格"},
                new String[]{"尺寸", "符合图纸要求", "符合要求", "合格"},
                new String[]{"材质", "与封样一致", "与封样一致", "合格"},
                new String[]{"检验数据1", "水分≤0.5%", "0.72%", "不合格"});
    }

    static String failReason(String category) {
        if ("原料制备车间".equals(category)) return "检验数据1（含量96.8%）低于≥98.0%标准，整批不合格";
        return "检验数据1（水分0.72%）超出≤0.5%标准，整批不合格";
    }

    // ==================== 校验 ====================

    static void verify(Connection c, int expInsp, int expDetail, int expRec, int expReturn) throws SQLException {
        int insp = count(c, "qc_insp"), detail = count(c, "qc_insp_detail");
        int rec = count(c, "qc_insp_rec"), recDet = count(c, "qc_insp_rec_detail");
        int ret = count(c, "qc_return"), retDet = count(c, "qc_return_detail");
        int cat = count(c, "qc_catalog"), catDet = count(c, "qc_catalog_detail");
        int audited = count(c, "qc_insp WHERE 单据状态=N'已审核' AND 审核人=N'" + REVIEWER + "'");
        int piLinks = count(c, "form_flow_link WHERE source_panel_code='QC_INSP' AND target_panel_code='PURCHASE_IN' AND link_status='ACTIVE'");
        System.out.printf("[verify] insp=%d/%d detail=%d/%d rec=%d/%d recDetail=%d ret=%d/%d retDetail=%d catalog=%d/%d audited=%d PI活跃链=%d%n",
                insp, expInsp, detail, expDetail, rec, expRec, recDet, ret, expReturn, retDet, cat, catDet, audited, piLinks);
        if (insp != expInsp || detail != expDetail || rec != expRec || ret != expReturn || cat != 1
                || audited != expInsp || piLinks != 0) {
            throw new IllegalStateException("重建结果校验失败");
        }
    }

    // ==================== 工具 ====================

    static void reserveNo(Connection c, String prefix, String no) throws SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("comm", "0");
        m.put("dh", no);
        m.put("lb", prefix);
        m.put("ny", NY);
        m.put("bz", "");
        m.put("asp_user1", REVIEWER);
        m.put("asp_time1", new Timestamp(System.currentTimeMillis()));
        m.put("asp_cancel", "N");
        insertRow(c, "s_allno", m);
    }

    static int nextSeq(Connection c, String prefix, String table, String col) throws SQLException {
        int pool = nvl0(intObj(scalar(c, "SELECT MAX(CAST(RIGHT(dh,4) AS int)) FROM s_allno WHERE lb=? AND dh LIKE ?",
                prefix, prefix + "-" + NY + "-%")));
        int doc = nvl0(intObj(scalar(c, "SELECT MAX(TRY_CAST(RIGHT(RTRIM([" + col + "]),4) AS int)) FROM [" + table + "] WHERE RTRIM([" + col + "]) LIKE ?",
                prefix + "-" + NY + "-[0-9][0-9][0-9][0-9]")));
        return Math.max(pool, doc) + 1;
    }

    /** 通用插入：列名 → 值；自增主键回填。 */
    static long insertRow(Connection c, String table, Map<String, Object> cols) throws SQLException {
        StringBuilder names = new StringBuilder(), marks = new StringBuilder();
        for (String k : cols.keySet()) {
            if (names.length() > 0) { names.append(','); marks.append(','); }
            names.append('[').append(k).append(']');
            marks.append('?');
        }
        String sql = "INSERT INTO [" + table + "] (" + names + ") VALUES (" + marks + ")";
        try (PreparedStatement ps = c.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            int i = 1;
            for (Object v : cols.values()) ps.setObject(i++, v);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (rs.next()) return rs.getLong(1);
            }
        }
        return 0;
    }

    static void exec(Connection c, String sql) throws SQLException {
        try (Statement st = c.createStatement()) { st.executeUpdate(sql); }
    }

    static int count(Connection c, String fromWhere) throws SQLException {
        return nvl0(intObj(scalar(c, "SELECT COUNT(*) FROM " + fromWhere)));
    }

    static Object scalar(Connection c, String sql, Object... params) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            for (int i = 0; i < params.length; i++) ps.setObject(i + 1, params[i]);
            try (ResultSet rs = ps.executeQuery()) { return rs.next() ? rs.getObject(1) : null; }
        }
    }

    static List<String> strList(Connection c, String sql) throws SQLException {
        List<String> out = new ArrayList<>();
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) out.add(rs.getString(1));
        }
        return out;
    }

    static boolean tableExists(Connection c, String name) throws SQLException {
        return scalar(c, "SELECT OBJECT_ID(?, 'U')", name) != null;
    }

    static String inList(List<String> xs) {
        StringBuilder sb = new StringBuilder();
        for (String x : xs) {
            if (sb.length() > 0) sb.append(',');
            sb.append('\'').append(x.replace("'", "''")).append('\'');
        }
        return sb.toString();
    }

    static String normDate(String s) {
        if (s == null || s.isBlank()) return BATCH_DATE;
        return s.trim().length() >= 10 ? s.trim().substring(0, 10) : s.trim();
    }

    static Timestamp timestamp(String date) {
        return Timestamp.valueOf(LocalDateTime.parse(date + " 12:00:00", TS));
    }

    static String qtyText(BigDecimal v) {
        return v == null ? "" : v.stripTrailingZeros().toPlainString();
    }

    static String joinRemark(String a, String b) {
        if (a == null || a.isBlank()) return b;
        return a + "；" + b;
    }

    static String nz(String s) { return s == null ? "" : s.trim(); }

    static BigDecimal dec(BigDecimal v) { return v == null ? BigDecimal.ZERO : v; }

    static Integer intObj(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.intValue();
        try { return Integer.valueOf(String.valueOf(o).trim()); } catch (Exception e) { return null; }
    }

    static int nvl0(Integer v) { return v == null ? 0 : v; }
}
