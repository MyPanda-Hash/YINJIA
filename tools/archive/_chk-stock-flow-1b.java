import java.sql.*;

/**
 * 任务 1b 收尾证据探针(只读):逐项核对收口结果 ——
 * ① UX_*_src_rid 是否过滤索引(has_filter=1 + filter_definition)
 * ② RKD/CKD 在 yj_panel/yj_field/yj_role_panel/yj_doc_status 是否已清
 * ③ 两张备份表是否已不存在
 * ④ inh/outh 表级中文注明
 * ⑤ 过滤索引能否容纳多行 (src=0, rid=NULL),且仍拦得住重复 (src,rid) —— 任务 2 的硬前提
 * ⑥ 首页库存卡片四段 SQL 能否无错执行(证明"列名无效"已消失)
 * 用法(tools 目录):java '-Dstdout.encoding=UTF-8' -cp lib\mssql-jdbc.jar archive/_chk-stock-flow-1b.java
 */
public class StockFlow1bCheck {
    static String url() {
        String db = System.getenv().getOrDefault("YINJIA_SQL_DB", "HSDZ_MES");
        return "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
    }

    static void q(Connection c, String title, String sql) {
        System.out.println("-- " + title);
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            int n = 0;
            while (rs.next() && n++ < 20) {
                StringBuilder row = new StringBuilder();
                for (int i = 1; i <= rs.getMetaData().getColumnCount(); i++)
                    row.append(i > 1 ? " | " : "").append(rs.getString(i));
                System.out.println("   " + row);
            }
            if (n == 0) System.out.println("   (no rows)");
        } catch (Exception e) { System.out.println("   ERR: " + e.getMessage()); }
    }

    public static void main(String[] a) throws Exception {
        try (Connection c = DriverManager.getConnection(url(), "yinjia",
                System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026"))) {
            System.out.println("======== 账套 " + c.getCatalog() + " ========");
            q(c, "① 唯一索引过滤状态", "SELECT name, has_filter, is_unique, ISNULL(filter_definition,'(无)') AS 过滤条件"
                    + " FROM sys.indexes WHERE name IN ('UX_inh_src_rid','UX_outh_src_rid') ORDER BY name");
            q(c, "② RKD/CKD 元数据残留(全应为 0)",
                    "SELECT 'yj_panel' AS t, COUNT(*) AS n FROM yj_panel WHERE panel_code IN ('RKD','CKD')"
                            + " UNION ALL SELECT 'yj_field', COUNT(*) FROM yj_field WHERE panel_code IN ('RKD','CKD')"
                            + " UNION ALL SELECT 'yj_role_panel', COUNT(*) FROM yj_role_panel WHERE panel_code IN ('RKD','CKD')"
                            + " UNION ALL SELECT 'yj_doc_status', COUNT(*) FROM yj_doc_status WHERE panel_code IN ('RKD','CKD')"
                            + " UNION ALL SELECT 'yj_translation(入库单/出库单)', COUNT(*) FROM yj_translation"
                            + "     WHERE scope='panel' AND ref_key IN (N'入库单',N'出库单')");
            q(c, "③ 备份表是否存在(应全部 0)",
                    "SELECT COUNT(*) AS 备份表数 FROM sys.tables WHERE name IN ('inh_bak_20260930','outh_bak_20260930')");
            q(c, "④ inh/outh 表级中文注明",
                    "SELECT OBJECT_NAME(major_id) AS 表名, CAST(value AS nvarchar(200)) AS 注明"
                            + " FROM sys.extended_properties WHERE minor_id=0 AND name='MS_Description'"
                            + " AND major_id IN (OBJECT_ID('dbo.inh'), OBJECT_ID('dbo.outh'))");
            q(c, "⑤ 过滤索引语义验证(期望:可插入 2 行 rid IS NULL,插首行 NULL 报错)",
                    "SELECT '待事务内实测(见下)' AS x");

            // ⑤ 事务内实测:证明过滤索引能容纳多行期初(任务 2 的硬前提)
            c.setAutoCommit(false);
            try (Statement st = c.createStatement()) {
                st.executeUpdate("INSERT INTO inh (src, rid, 单据编号, 数量) VALUES (0, NULL, N'__probe1b_a', 1)");
                st.executeUpdate("INSERT INTO inh (src, rid, 单据编号, 数量) VALUES (0, NULL, N'__probe1b_b', 1)");
                ResultSet r = st.executeQuery("SELECT COUNT(*) FROM inh WHERE src=0 AND rid IS NULL");
                r.next();
                System.out.println("   实测①: 过滤索引下成功插入 2 行 (src=0, rid=NULL) ⇒ 计数 " + r.getInt(1) + " ✓(任务 2 可灌多行期初)");
                // 再验"仍拦得住重复 (src,rid)":插两行 (src=1, rid=990001)
                st.executeUpdate("INSERT INTO inh (src, rid, 单据编号, 数量) VALUES (1, 990001, N'__probe1b_c', 1)");
                String dup = "未拦截(异常!)";
                try { st.executeUpdate("INSERT INTO inh (src, rid, 单据编号, 数量) VALUES (1, 990001, N'__probe1b_d', 1)"); }
                catch (SQLException e) { dup = "已拦截,错误号 " + e.getErrorCode() + "(2601=唯一索引冲突)"; }
                System.out.println("   实测②: 重复 (src,rid) " + dup + " ✓");
                c.rollback();
                System.out.println("   已回滚,未留任何行 ✓");
            } catch (Exception e) {
                c.rollback();
                System.out.println("   实测失败(已回滚): " + e.getMessage());
            } finally { c.setAutoCommit(true); }

            q(c, "⑥ 首页库存卡片四段 SQL 冒烟(改列名后应全部 0 错)",
                    "SELECT (SELECT COUNT(DISTINCT 单据编号) FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y') AS 入库单数,"
                            + " (SELECT COUNT(DISTINCT 单据编号) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y') AS 出库单数,"
                            + " (SELECT COUNT(*) FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y') AS 入库行数,"
                            + " (SELECT COUNT(*) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y') AS 出库行数");
            q(c, "⑥b 近 7 天趋势 SQL",
                    "SELECT CONVERT(varchar(10), 单据日期, 23) AS d, COUNT(*) AS v FROM inh"
                            + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 >= DATEADD(day,-6,CONVERT(date,GETDATE()))"
                            + " GROUP BY CONVERT(varchar(10), 单据日期, 23)");
            q(c, "inh/outh 当前行数", "SELECT (SELECT COUNT(*) FROM inh) AS inh, (SELECT COUNT(*) FROM outh) AS outh");
        }
    }
}
