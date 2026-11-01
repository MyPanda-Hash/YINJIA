import java.math.BigDecimal;
import java.sql.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 来料检验结果“去全不合格化”（2026-10-21 用户口径二）。
 *
 * 背景：上一轮 QcRegen 为满足“只要退料单”把 16 行全判不合格。用户要求：
 *   ① 不能全不合格，要有合格的，趋近真实；
 *   ② 对应采购入库单删除（本轮新建检验单不保留任何入库单）；
 *   ③ 退料单也要对应审批；
 *   ④ 修改转ERP状态。
 *
 * 口径（保持现有单号不变，原地改）：
 *   · 11 行合格 / 5 行不合格（不合格行：0205-XH002、0208-YKRS009、0211-XH002、0214-YPS002、0216-YSZ）；
 *   · 合格行：合格数量=送检数量、处置方式=入库、检验结论/目录=合格；不合格行反之=退货；
 *   · 只保留不合格行对应的 5 张退料单，其余 7 张退料单删除；
 *   · 5 张退料单全部置已审核（审核人/审批人=冯敏），并回写“是否已转ERP=是 + ERP单号 + 操作人/时间”；
 *   · 12 张检验单不保留采购入库单（清理 QC_INSP→PURCHASE_IN 活跃链/草稿入库单）。
 *
 * 用法（tools 目录）：
 *   java -cp lib/mssql-jdbc.jar archive/_qc-cleanup-probe-20261021/QcMixFix.java           # 只打印
 *   java -cp lib/mssql-jdbc.jar archive/_qc-cleanup-probe-20261021/QcMixFix.java --apply   # 执行
 */
public class QcMixFix {

    static final String URL = env("YINJIA_SQL_URL",
            "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;loginTimeout=15");
    static final String USER = env("YINJIA_SQL_USER", "yinjia");
    static final String PASS = env("YINJIA_SQL_PASS", "Yinjia@2026");
    static final String REVIEWER = "冯敏";
    static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /** 运行时按物料配额选出的不合格行（检验单号|物料编码）。 */
    static Set<String> FAIL = Set.of();

    record Insp(String no, String date) {}
    record Det(long id, String inspNo, String date, String materialCode, String materialName,
               String spec, String desc, BigDecimal qty, BigDecimal price, String unit,
               String orderLine, String batch, Integer batchId, String category, String supplier) {}

    static String env(String k, String def) {
        String v = System.getenv(k);
        return v == null || v.isBlank() ? def : v.trim();
    }

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
        List<Insp> insps = loadInsps(c);
        List<Det> dets = loadDets(c);
        if (insps.isEmpty() || dets.isEmpty()) {
            throw new IllegalStateException("当前没有可处理的检验单/明细；请先执行 QcRegen --apply");
        }
        FAIL = chooseFails(dets);
        long pass = dets.stream().filter(d -> !isFail(d)).count();
        long fail = dets.size() - pass;
        System.out.println("[plan] 检验单=" + insps.size() + " 明细=" + dets.size()
                + " 合格=" + pass + " 不合格=" + fail);
        for (Det d : dets) {
            if (isFail(d)) System.out.println("  [不合格] " + d.inspNo + " " + d.materialCode + " " + d.qty + d.unit);
        }

        if (!apply) {
            System.out.println("[dry-run] 未修改。加 --apply 执行。");
            return;
        }

        backup(c);
        // 1) 明细/记录/目录/检验单结论
        Map<String, List<Det>> byInsp = new LinkedHashMap<>();
        for (Det d : dets) byInsp.computeIfAbsent(d.inspNo, k -> new ArrayList<>()).add(d);

        for (Insp insp : insps) {
            List<Det> lines = byInsp.getOrDefault(insp.no, List.of());
            long docFail = lines.stream().filter(QcMixFix::isFail).count();
            for (Det d : lines) {
                boolean ok = !isFail(d);
                BigDecimal okQty = ok ? d.qty : BigDecimal.ZERO;
                BigDecimal badQty = ok ? BigDecimal.ZERO : d.qty;
                String reason = ok ? "检验合格，同意入库。" : failReason(d.category);
                update(c, "UPDATE qc_insp_detail SET 合格数量=?, 不合格数量=?, 不良数量=?, 处置方式=?, 备注=?,"
                                + " 入库单号=NULL, asp_user2=?, asp_time2=? WHERE id=?",
                        okQty, badQty, badQty, ok ? "入库" : "退货", reason,
                        REVIEWER, timestamp(d.date), d.id);

                update(c, "UPDATE qc_insp_rec SET 检验结论=?, 处理意见=?, 备注=?, asp_user2=?, asp_time2=?"
                                + " WHERE 来料检验单号=? AND 物料编码=?",
                        ok ? "合格" : "不合格",
                        ok ? "检验合格，同意入库。" : "整批退货，通知供应商整改。",
                        ok ? "所检项目符合标准要求。" : reason,
                        REVIEWER, timestamp(d.date), d.inspNo, d.materialCode);

                if (ok) {
                    update(c, "UPDATE qc_insp_rec_detail SET 检测结果=?, 单项判定=N'合格'"
                                    + " WHERE 单据编号=(SELECT TOP 1 单据编号 FROM qc_insp_rec WHERE 来料检验单号=? AND 物料编码=?)"
                                    + " AND 检验项=N'检验数据1'",
                            chemical(d) ? "99.2%" : "0.32%", d.inspNo, d.materialCode);
                }

                update(c, "UPDATE qc_catalog_detail SET 是否合格=? WHERE 检验单号=? AND 物料编码=?",
                        ok ? "合格" : "不合格", d.inspNo, d.materialCode);
            }
            String conclusion = docFail == 0 ? "合格" : "不合格";
            String remark = docFail == 0 ? "来料检验合格，同意入库。"
                    : (docFail == lines.size() ? "来料检验不合格，整批退回供应商。"
                    : "部分合格、部分不合格；合格行不保留采购入库单，不合格行退货。");
            update(c, "UPDATE qc_insp SET 总结论=?, 备注=?, asp_user2=?, asp_time2=? WHERE 单据编号=?",
                    conclusion, remark, REVIEWER, timestamp(insp.date), insp.no);
        }

        // 2) 退料单：只保留不合格行；删除其余退料单
        List<Map<String, Object>> returns = rows(c,
                "SELECT id, 单据编号, 检验单号, 单据日期, 供应商 FROM qc_return ORDER BY 单据编号");
        int kept = 0, deleted = 0;
        int erpSeq = 1;
        for (Map<String, Object> r : returns) {
            String retNo = str(r.get("单据编号"));
            String inspNo = str(r.get("检验单号"));
            String date = str(r.get("单据日期"));
            List<Det> fails = byInsp.getOrDefault(inspNo, List.of()).stream().filter(QcMixFix::isFail).toList();

            // 先清掉该退料单的旧明细与流转链
            update(c, "DELETE FROM form_flow_link WHERE target_panel_code='QC_RETURN' AND target_form_no=?", retNo);
            update(c, "DELETE FROM qc_return_detail WHERE 单据编号=?", retNo);

            if (fails.isEmpty()) {
                update(c, "DELETE FROM yj_form_approval WHERE panel_code='QC_RETURN' AND form_no=?", retNo);
                update(c, "DELETE FROM yj_doc_status WHERE panel_code='QC_RETURN' AND doc_no=?", retNo);
                update(c, "DELETE FROM qc_return WHERE 单据编号=?", retNo);
                deleted++;
                continue;
            }

            BigDecimal sum = fails.stream().map(Det::qty).reduce(BigDecimal.ZERO, BigDecimal::add);
            String erpNo = nextErpNo(c, date, erpSeq++);
            update(c, "UPDATE qc_return SET 数量=?, 单据状态=N'已审核', 审核人=?, 审核时间=?, 审批人=?, 审批时间=?,"
                            + " 是否已转ERP=N'是', ERP单号=?, 转ERP操作人=?, 转ERP时间=?,"
                            + " 备注=N'来料检验部分不合格，仅不合格行退回供应商。', asp_user2=?, asp_time2=?"
                            + " WHERE 单据编号=?",
                    sum, REVIEWER, date + " 12:00:00", REVIEWER, date + " 12:00:00",
                    erpNo, REVIEWER, date, REVIEWER, timestamp(date), retNo);

            for (Det d : fails) {
                String reason = failReason(d.category);
                long retDetailId = insertReturnDetail(c, retNo, d, reason);
                link(c, inspNo, inspNo + "#" + d.id, retNo, retNo + "#" + retDetailId,
                        d.materialCode, d.qty, d.qty, d.batch, d.batchId);
            }
            updateDocStatus(c, retNo, date);
            insertApproval(c, retNo, date);
            kept++;
        }

        // 3) 不保留本次检验单对应的采购入库单
        String in = inList(insps.stream().map(Insp::no).toList());
        List<String> piNos = strList(c,
                "SELECT DISTINCT l.target_form_no FROM form_flow_link l"
                        + " JOIN bd_purchase_in h ON h.单据编号=l.target_form_no"
                        + " WHERE l.source_panel_code='QC_INSP' AND l.target_panel_code='PURCHASE_IN'"
                        + " AND l.source_form_no IN (" + in + ")"
                        + " AND ISNULL(h.单据状态,N'')=N'草稿'");
        update(c, "DELETE FROM form_flow_link WHERE source_panel_code='QC_INSP' AND target_panel_code='PURCHASE_IN'"
                + " AND source_form_no IN (" + in + ")");
        if (!piNos.isEmpty()) {
            String piIn = inList(piNos);
            update(c, "DELETE FROM bl_purchase_in WHERE 单据编号 IN (" + piIn + ")");
            update(c, "DELETE FROM bd_purchase_in WHERE 单据编号 IN (" + piIn + ")");
            update(c, "DELETE FROM yj_doc_status WHERE panel_code='PURCHASE_IN' AND doc_no IN (" + piIn + ")");
        }
        System.out.println("[pi] 删除本次检验单对应的草稿采购入库单 " + piNos.size() + " 张"
                + (piNos.isEmpty() ? "" : " " + piNos));

        System.out.println("[returns] 保留并审批 " + kept + " 张，删除 " + deleted + " 张");
        verify(c, (int) pass, (int) fail, kept);
    }

    static Set<String> chooseFails(List<Det> dets) {
        // 物料配额：优先让真实业务里更容易出问题的物料承担不合格，且总不合格行数不超过 5。
        Map<String, Integer> quota = new LinkedHashMap<>();
        quota.put("YJ-XH-002", 2);
        quota.put("YJ-YKRS-009", 1);
        quota.put("YJ-YPS-002", 1);
        quota.put("Y-S-Z", 1);
        Set<String> fail = new LinkedHashSet<>();
        int target = Math.min(5, dets.size());
        for (Det d : dets) {
            int q = quota.getOrDefault(d.materialCode, 0);
            if (q > 0 && fail.size() < target) {
                fail.add(d.inspNo + "|" + d.materialCode);
                quota.put(d.materialCode, q - 1);
            }
        }
        // 物料不齐时按顺序补足，保证至少有 1 行不合格、总行数可控。
        for (Det d : dets) {
            if (fail.size() >= target) break;
            fail.add(d.inspNo + "|" + d.materialCode);
        }
        return fail;
    }

    static boolean isFail(Det d) { return FAIL.contains(d.inspNo + "|" + d.materialCode); }

    static boolean chemical(Det d) {
        return "Y-S-N".equals(d.materialCode) || "Y-S-Z".equals(d.materialCode)
                || "原料制备车间".equals(d.category);
    }

    static String failReason(String category) {
        if ("原料制备车间".equals(category)) return "检验数据1（含量96.8%）低于≥98.0%标准，整批不合格";
        return "检验数据1（水分0.72%）超出≤0.5%标准，整批不合格";
    }

    // ==================== 数据加载 ====================

    static List<Insp> loadInsps(Connection c) throws SQLException {
        List<Insp> out = new ArrayList<>();
        for (Map<String, Object> r : rows(c, "SELECT 单据编号, 单据日期 FROM qc_insp ORDER BY 单据编号")) {
            out.add(new Insp(str(r.get("单据编号")), str(r.get("单据日期"))));
        }
        return out;
    }

    static List<Det> loadDets(Connection c) throws SQLException {
        String sql = """
                SELECT d.id, d.单据编号, h.单据日期, d.物料编码, d.物料名称, d.规格型号, d.物料描述,
                       d.送检数量, d.单价, d.单位, d.采购订单行号, d.批次号, h.批次键, i.所属类别,
                       h.供应商
                FROM qc_insp_detail d
                JOIN qc_insp h ON h.单据编号=d.单据编号
                LEFT JOIN bs_inv i ON LTRIM(RTRIM(i.存货编码))=LTRIM(RTRIM(d.物料编码))
                ORDER BY d.单据编号, d.id
                """;
        List<Det> out = new ArrayList<>();
        for (Map<String, Object> r : rows(c, sql)) {
            out.add(new Det(
                    ((Number) r.get("id")).longValue(), str(r.get("单据编号")), str(r.get("单据日期")),
                    str(r.get("物料编码")), str(r.get("物料名称")), str(r.get("规格型号")), str(r.get("物料描述")),
                    dec(r.get("送检数量")), dec(r.get("单价")), str(r.get("单位")), str(r.get("采购订单行号")),
                    str(r.get("批次号")), intObj(r.get("批次键")), str(r.get("所属类别")), str(r.get("供应商"))));
        }
        return out;
    }

    // ==================== 退料单明细 ====================

    static long insertReturnDetail(Connection c, String retNo, Det d, String reason) throws SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("单据编号", retNo);
        m.put("物料编码", d.materialCode);
        m.put("物料名称", d.materialName);
        m.put("物料描述", d.desc);
        m.put("退货数量", d.qty);
        m.put("送检数量", d.qty);
        m.put("日期", d.date);
        m.put("供应商", d.supplier);
        m.put("单价", d.price);
        m.put("金额", d.price == null ? null : d.price.multiply(d.qty));
        m.put("asp_user1", REVIEWER);
        m.put("asp_time1", timestamp(d.date));
        m.put("asp_user2", REVIEWER);
        m.put("asp_time2", timestamp(d.date));
        m.put("采购订单行号", d.orderLine);
        m.put("计量单位", d.unit);
        m.put("批次号", d.batch);
        m.put("不良原因", reason);
        m.put("报废数量", BigDecimal.ZERO);
        m.put("剩余数量", BigDecimal.ZERO);
        m.put("规格型号", d.spec);
        return insertRow(c, "qc_return_detail", m);
    }

    static void link(Connection c, String srcNo, String srcLine, String tgtNo, String tgtLine,
                     String invCode, BigDecimal sourceQty, BigDecimal linkedQty, String batchNo, Integer batchId) throws SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("source_panel_code", "QC_INSP");
        m.put("source_form_no", srcNo);
        m.put("source_line_key", srcLine);
        m.put("target_panel_code", "QC_RETURN");
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

    static void updateDocStatus(Connection c, String retNo, String date) throws SQLException {
        update(c, "UPDATE yj_doc_status SET shr=?, shsj=?, pending='N', saved='Y', archived='N', canceled='N',"
                        + " update_at=SYSDATETIME() WHERE panel_code='QC_RETURN' AND doc_no=?",
                REVIEWER, timestamp(date), retNo);
    }

    static void insertApproval(Connection c, String retNo, String date) throws SQLException {
        update(c, "DELETE FROM yj_form_approval WHERE panel_code='QC_RETURN' AND form_no=?", retNo);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("panel_code", "QC_RETURN");
        m.put("form_no", retNo);
        m.put("action", "APPROVE");
        m.put("result", "APPROVED");
        m.put("node_no", 1);
        m.put("operator", REVIEWER);
        m.put("opinion", "同意退货");
        m.put("create_time", timestamp(date));
        insertRow(c, "yj_form_approval", m);
    }

    static String nextErpNo(Connection c, String date, int seq) throws SQLException {
        String compact = date.replace("-", "");
        for (int i = seq; i < 99999; i++) {
            String no = "CGTH-" + compact + "-" + String.format("%05d", i);
            Integer n = intObj(scalar(c, "SELECT COUNT(*) FROM qc_return WHERE ERP单号=?", no));
            if (n == null || n == 0) return no;
        }
        throw new IllegalStateException("ERP单号生成失败");
    }

    // ==================== 备份/校验/工具 ====================

    static void backup(Connection c) throws SQLException {
        String suffix = "_bak_qcmix_20261021";
        for (String[] t : new String[][]{
                {"qc_insp", "SELECT * FROM qc_insp"},
                {"qc_insp_detail", "SELECT * FROM qc_insp_detail"},
                {"qc_insp_rec", "SELECT * FROM qc_insp_rec"},
                {"qc_insp_rec_detail", "SELECT * FROM qc_insp_rec_detail"},
                {"qc_catalog_detail", "SELECT * FROM qc_catalog_detail"},
                {"qc_return", "SELECT * FROM qc_return"},
                {"qc_return_detail", "SELECT * FROM qc_return_detail"},
                {"yj_doc_status", "SELECT * FROM yj_doc_status WHERE panel_code IN ('QC_INSP','QC_CATALOG','QC_INSP_REC','QC_RETURN')"},
                {"form_flow_link", "SELECT * FROM form_flow_link WHERE source_panel_code IN ('QC_RECV','QC_INSP')"},
                {"yj_form_approval", "SELECT * FROM yj_form_approval WHERE panel_code IN ('QC_INSP','QC_RETURN')"}}) {
            String name = suffix + "_" + t[0];
            for (int i = 2; tableExists(c, name); i++) name = suffix + "_" + t[0] + "_" + i;
            exec(c, "SELECT * INTO " + name + " FROM (" + t[1] + ") x");
            System.out.println("[backup] " + name);
        }
    }

    static void verify(Connection c, int expPass, int expFail, int expReturns) throws SQLException {
        int pass = count(c, "qc_insp_detail WHERE 合格数量>0");
        int fail = count(c, "qc_insp_detail WHERE 不合格数量>0");
        int okInsp = count(c, "qc_insp WHERE 总结论=N'合格'");
        int badInsp = count(c, "qc_insp WHERE 总结论=N'不合格'");
        int ret = count(c, "qc_return");
        int retDet = count(c, "qc_return_detail");
        int retAudited = count(c, "qc_return WHERE 单据状态=N'已审核' AND 审核人=N'冯敏'");
        int erp = count(c, "qc_return WHERE 是否已转ERP=N'是' AND ISNULL(ERP单号,N'')<>N''");
        int piLinks = count(c, "form_flow_link WHERE source_panel_code='QC_INSP' AND target_panel_code='PURCHASE_IN' AND link_status='ACTIVE'");
        int catPass = count(c, "qc_catalog_detail WHERE 是否合格=N'合格'");
        int catFail = count(c, "qc_catalog_detail WHERE 是否合格=N'不合格'");
        int recPass = count(c, "qc_insp_rec WHERE 检验结论=N'合格'");
        int recFail = count(c, "qc_insp_rec WHERE 检验结论=N'不合格'");
        System.out.printf("[verify] 明细合格=%d/%d 不合格=%d/%d 检验单合格=%d 不合格=%d 退料单=%d/%d 明细=%d 已审核=%d 已转ERP=%d 活跃入库链=%d 目录合格/不合格=%d/%d 记录合格/不合格=%d/%d%n",
                pass, expPass, fail, expFail, okInsp, badInsp, ret, expReturns, retDet, retAudited, erp, piLinks,
                catPass, catFail, recPass, recFail);
        if (pass != expPass || fail != expFail || ret != expReturns || retAudited != expReturns
                || erp != expReturns || piLinks != 0 || catPass != expPass || catFail != expFail
                || recPass != expPass || recFail != expFail) {
            throw new IllegalStateException("结果校验失败");
        }
    }

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
            try (ResultSet rs = ps.getGeneratedKeys()) { if (rs.next()) return rs.getLong(1); }
        }
        return 0;
    }

    static void update(Connection c, String sql, Object... params) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            for (int i = 0; i < params.length; i++) ps.setObject(i + 1, params[i]);
            ps.executeUpdate();
        }
    }

    static void exec(Connection c, String sql) throws SQLException {
        try (Statement st = c.createStatement()) { st.executeUpdate(sql); }
    }

    static List<Map<String, Object>> rows(Connection c, String sql, Object... params) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            for (int i = 0; i < params.length; i++) ps.setObject(i + 1, params[i]);
            try (ResultSet rs = ps.executeQuery()) {
                ResultSetMetaData md = rs.getMetaData();
                List<Map<String, Object>> out = new ArrayList<>();
                while (rs.next()) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    for (int i = 1; i <= md.getColumnCount(); i++) m.put(md.getColumnLabel(i), rs.getObject(i));
                    out.add(m);
                }
                return out;
            }
        }
    }

    static List<String> strList(Connection c, String sql) throws SQLException {
        List<String> out = new ArrayList<>();
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) out.add(rs.getString(1));
        }
        return out;
    }

    static Object scalar(Connection c, String sql, Object... params) throws SQLException {
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            for (int i = 0; i < params.length; i++) ps.setObject(i + 1, params[i]);
            try (ResultSet rs = ps.executeQuery()) { return rs.next() ? rs.getObject(1) : null; }
        }
    }

    static int count(Connection c, String fromWhere) throws SQLException {
        return intObj(scalar(c, "SELECT COUNT(*) FROM " + fromWhere));
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

    static Timestamp timestamp(String date) {
        return Timestamp.valueOf(LocalDateTime.parse(date + " 12:00:00", TS));
    }

    static String str(Object o) { return o == null ? "" : String.valueOf(o).trim(); }

    static BigDecimal dec(Object o) {
        if (o == null) return BigDecimal.ZERO;
        if (o instanceof BigDecimal b) return b;
        return new BigDecimal(String.valueOf(o));
    }

    static Integer intObj(Object o) {
        if (o == null) return 0;
        if (o instanceof Number n) return n.intValue();
        try { return Integer.valueOf(String.valueOf(o).trim()); } catch (Exception e) { return 0; }
    }
}
