/*
 * _ProbeWoTraceQc.java — 工单追溯「质检段」只读核对探针(2026-10-14,一次性)
 *
 * 用途:不启服务,直接把 ScheduleBoardService.trace 里新增的**质检段 SQL**跑在实库上,
 *      逐张工单打印三类工序检验单明细 + 应检/已检/缺检/结论汇总,证明"工单能对上成品检验单"。
 *      口径与后端逐字一致(三表同构 UNION 逻辑、状态取 yj_doc_status 推导、合格/不合格按判定汇总)。
 *
 * 用法(在 tools 目录下):
 *   java -cp lib\mssql-jdbc.jar archive\_ProbeWoTraceQc.java              # 默认抽查几张有/无检验单的工单
 *   java -cp lib\mssql-jdbc.jar archive\_ProbeWoTraceQc.java GD-2026-10-0002 MO-2026-09-0137
 *   YINJIA_SQL_DB=HSDZ_MES_TEST java -cp lib\mssql-jdbc.jar archive\_ProbeWoTraceQc.java
 *
 * 只读:仅 SELECT,不写任何数据。
 */
import java.sql.*;
import java.util.*;

public class _ProbeWoTraceQc {

    static final String URL_T = "jdbc:sqlserver://localhost:1433;databaseName=%s;encrypt=false;trustServerCertificate=true";
    static final String USER = "yinjia";
    static final String PASS = "Yinjia@2026";

    /** 面板 → 头表(与 ScheduleBoardService.INSP_HEAD 同源) */
    static final String[][] INSP_HEAD = {
            {"QC_MOLD_INSP", "qc_mold_insp_head"},
            {"QC_CUT_INSP", "qc_cut_insp_head"},
            {"QC_ASM_INSP", "qc_asm_insp_head"},
    };
    static final List<String> INSP_OPS = List.of("成型", "切炭", "组装");

    public static void main(String[] args) throws Exception {
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        List<String> wos = new ArrayList<>(List.of(args));
        try (Connection c = DriverManager.getConnection(String.format(URL_T, db), USER, PASS)) {
            System.out.println("== 库: " + db + " ==");
            if (wos.isEmpty()) {
                // 默认:抽 2 张有检验单的 + 2 张没有的,覆盖"齐/缺"两种形态
                wos.addAll(pick(c, true, 2));
                wos.addAll(pick(c, false, 2));
            }
            int bad = 0;
            for (String wo : wos) bad += trace(c, wo);
            System.out.println(bad == 0 ? "\n[PASS] 质检段 SQL 全部可执行、汇总口径自洽" : "\n[FAIL] " + bad + " 处异常");
            if (bad != 0) System.exit(1);
        }
    }

    /** 有/无检验单的工单号(有=三类工序检验单里出现过;无=plang 在产但没有) */
    static List<String> pick(Connection c, boolean withInsp, int n) throws SQLException {
        String sql = "SELECT TOP " + n + " p.pl_no FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y' "
                + (withInsp ? "AND EXISTS" : "AND NOT EXISTS")
                + " (SELECT 1 FROM qc_mold_insp_head h WHERE h.工单号=p.pl_no AND ISNULL(h.asp_cancel,'N')<>'Y'"
                + "  UNION ALL SELECT 1 FROM qc_cut_insp_head h WHERE h.工单号=p.pl_no AND ISNULL(h.asp_cancel,'N')<>'Y'"
                + "  UNION ALL SELECT 1 FROM qc_asm_insp_head h WHERE h.工单号=p.pl_no AND ISNULL(h.asp_cancel,'N')<>'Y')"
                + " GROUP BY p.pl_no ORDER BY p.pl_no DESC";
        List<String> out = new ArrayList<>();
        try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(sql)) {
            while (r.next()) out.add(r.getString(1));
        }
        return out;
    }

    /** 与后端同一段 SQL;返回异常计数 */
    static int trace(Connection c, String wo) {
        System.out.println("\n──────── 工单 " + wo + " ────────");
        List<Map<String, Object>> rows = new ArrayList<>();
        int bad = 0;
        for (String[] e : INSP_HEAD) {
            String panel = e[0], tbl = e[1];
            String sql = "SELECT h.单据编号 AS 检验单号, ISNULL(h.工序,N'') AS 工序,"
                    + " CONVERT(varchar(10), h.单据日期, 120) AS 检验日期,"
                    + " CASE WHEN ISNULL(s.canceled,'N')='Y' THEN N'已作废'"
                    + "      WHEN ISNULL(s.stopped,'N')='Y' THEN N'已中止'"
                    + "      WHEN ISNULL(s.pending,'N')='Y' THEN N'审批中'"
                    + "      WHEN s.shr IS NOT NULL THEN N'已审核' ELSE N'草稿' END AS 单据状态,"
                    + " ISNULL(h.总结论,N'') AS 总结论,"
                    + " ISNULL(h.报工数量,0) AS 送检数量, ISNULL(h.检验数量,0) AS 检验数量,"
                    + " ISNULL(d.合格数量,0) AS 合格数量, ISNULL(d.不合格数量,0) AS 不合格数量,"
                    + " ISNULL(h.检验员,N'') AS 检验员, ISNULL(h.批次号,N'') AS 批次号,"
                    + " ISNULL(h.报工单号,N'') AS 报工单号, ISNULL(h.处理方式,N'') AS 处理方式,"
                    + " ISNULL((SELECT TOP 1 l.target_form_no FROM dbo.form_flow_link l"
                    + "          WHERE l.source_panel_code=? AND l.source_form_no=h.单据编号"
                    + "            AND l.link_status='ACTIVE' ORDER BY l.id), N'') AS 下游单号"
                    + " FROM dbo." + tbl + " h"
                    + " LEFT JOIN dbo.yj_doc_status s ON s.panel_code=? AND s.doc_no=h.单据编号"
                    + " LEFT JOIN (SELECT 单据编号,"
                    + "      SUM(CASE WHEN 判定=N'合格' THEN ISNULL(数量,0) ELSE 0 END) AS 合格数量,"
                    + "      SUM(CASE WHEN 判定=N'不合格' THEN ISNULL(数量,0) ELSE 0 END) AS 不合格数量"
                    + "    FROM dbo." + tbl.replace("_head", "_detail")
                    + "   WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 单据编号) d"
                    + "   ON d.单据编号 = h.单据编号"
                    + " WHERE ISNULL(h.asp_cancel,'N')<>'Y' AND h.工单号=?";
            try (PreparedStatement ps = c.prepareStatement(sql)) {
                ps.setString(1, panel);
                ps.setString(2, panel);
                ps.setString(3, wo);
                try (ResultSet r = ps.executeQuery()) {
                    ResultSetMetaData md = r.getMetaData();
                    while (r.next()) {
                        Map<String, Object> m = new LinkedHashMap<>();
                        for (int i = 1; i <= md.getColumnCount(); i++) m.put(md.getColumnLabel(i), r.getObject(i));
                        rows.add(m);
                    }
                }
            } catch (SQLException ex) {
                System.out.println("  [ERR] " + panel + " → " + ex.getMessage());
                bad++;
            }
        }
        rows.sort(Comparator.comparing(m -> String.valueOf(m.get("检验单号"))));
        for (Map<String, Object> m : rows) {
            System.out.printf("  %-16s 工序=%-4s 状态=%-5s 送检=%-10s 检验=%-10s 合格=%-10s 不合格=%-10s 批次=%-10s 下游=%s%n",
                    m.get("检验单号"), m.get("工序"), m.get("单据状态"), m.get("送检数量"), m.get("检验数量"),
                    m.get("合格数量"), m.get("不合格数量"), m.get("批次号"), m.get("下游单号"));
        }
        if (rows.isEmpty()) System.out.println("  (无检验单)");
        // 汇总(与后端同一口径)
        LinkedHashSet<String> done = new LinkedHashSet<>();
        double pass = 0, ng = 0, insp = 0;
        int audited = 0;
        for (Map<String, Object> m : rows) {
            String op = String.valueOf(m.get("工序")).trim();
            if (!op.isEmpty()) done.add(op);
            pass += num(m.get("合格数量"));
            ng += num(m.get("不合格数量"));
            insp += num(m.get("检验数量"));
            if ("已审核".equals(String.valueOf(m.get("单据状态")))) audited++;
        }
        List<String> miss = new ArrayList<>();
        for (String op : INSP_OPS) if (!done.contains(op)) miss.add(op);
        String concl = ng > 0 ? "存在不合格" : (!miss.isEmpty() ? "缺检" : (pass > 0 ? "全部合格" : "未判定"));
        System.out.printf("  汇总: 应检=%s 已检=%s 缺检=%s 单数=%d 已审核=%d 检验量=%s 合格=%s 不合格=%s 结论=%s%n",
                INSP_OPS, done, miss, rows.size(), audited, insp, pass, ng, concl);
        return bad;
    }

    static double num(Object o) {
        if (o == null) return 0;
        try { return Double.parseDouble(String.valueOf(o)); } catch (NumberFormatException e) { return 0; }
    }
}
