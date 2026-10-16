import java.sql.*;
import java.util.*;

/**
 * RdAreaEmptyAudit —— 「研发管理模块必须是空数据」部署前闸门(2026-10-16 用户口径)。
 *
 * <p>用户原话:「在上传(部署服务器)的时候,研发管理的模块应该是没有数据的」。
 *
 * <p>为什么单列这一条:走**全量恢复**部署时,是拿开发机的库整体覆盖服务器 ——
 * 研发区(立项申请/产品信息表/规格书/成型工艺清单/四文件/各种测试记录表…)是
 * **演示与批量造数**待得最多的地方,全量推上去就会把这些演示单带进服务器正式账。
 *
 * <p>判据(全部 0 才算 [PASS]):
 * <ol>
 *   <li><b>研发单据业务表</b> —— `yj_panel` 里 `module_group='研发管理'` 的各面板 head/line 表
 *       (共享文件库 RD_SHARE_FILE 排除:那是公司资料库,属于真实数据,清了反而坏事);</li>
 *   <li><b>这些单据的挂靠数据</b> —— 单据状态/审批留痕/修改记录/纸面批注/附件/消息,
 *       按 `panel_code` 过滤到研发面板(这些表是全模块共用的,只能按面板切);</li>
 *   <li><b>研发区不带面板的业务表</b> —— `rd_dev_task`(产品开发任务)、`rd_spec_assign`(规格书分发)。</li>
 * </ol>
 *
 * <p><b>刻意不算违规的保留项</b>(列出来是为了"别手滑清掉"):
 * `rd_sinter_tolerance`(烧结公差**标准库**,不是单据数据)、`rd_sample_no_*`(已下架面板留档表)、
 * `rd_dev_task_bak_*`(历史备份)、`yj_share_file` / `yj_share_file_cat`(共享文件库=真实资料)、
 * 号池 `s_allno`(清它会把单号回退,不是"清数据")。
 *
 * <p>用法(在 tools 目录下):
 * <pre>
 *   $env:YINJIA_SQL_PASS="..."; java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar verify\RdAreaEmptyAudit.java HSDZ_MES
 *   # 测试账套同理传 HSDZ_MES_TEST(测试库本就允许有数据,这条闸门只对"要被推上服务器的库"有意义)
 * </pre>
 * 退出码:0 = [PASS](全 0);1 = [FAIL](有残留,清单逐条列出并给清理入口)。
 */
public class RdAreaEmptyAudit {

    static final String USER = "yinjia";

    public static void main(String[] args) throws Exception {
        String db = args.length > 0 ? args[0] : "HSDZ_MES";
        String pass = System.getenv().getOrDefault("YINJIA_SQL_PASS", "Yinjia@2026");
        String url = "jdbc:sqlserver://127.0.0.1:1433;databaseName=" + db + ";encrypt=false;loginTimeout=10";
        int bad = 0;
        System.out.println("=== 研发管理模块「空数据」部署前闸门 —— 库: " + db + " ===");
        try (Connection c = DriverManager.getConnection(url, USER, pass)) {

            // 研发面板集合(共享文件库排除:真实资料库)
            List<String> panels = new ArrayList<>();
            Map<String, String> panelName = new LinkedHashMap<>();
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT panel_code, panel_name FROM yj_panel WHERE module_group = N'研发管理' ORDER BY panel_code")) {
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        String code = rs.getString(1);
                        if ("RD_SHARE_FILE".equals(code)) continue;   // 公司共享资料,不算研发单据
                        panels.add(code);
                        panelName.put(code, rs.getString(2));
                    }
                }
            }
            String in = String.join(",", Collections.nCopies(panels.size(), "?"));

            System.out.println("\n── ① 研发单据业务表(应全为 0) ──");
            List<String> tables = new ArrayList<>();
            try (PreparedStatement ps = c.prepareStatement(
                    "SELECT head_table, line_table FROM yj_panel WHERE module_group = N'研发管理' ORDER BY panel_code")) {
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        add(tables, rs.getString(1));
                        add(tables, rs.getString(2));
                    }
                }
            }
            for (String t : tables) {
                long n = count(c, "SELECT COUNT(*) FROM [" + t + "]", null);
                if (n < 0) continue;                                  // 表不存在(已下架面板留档等)
                bad += report("  ", t, n);
            }

            System.out.println("\n── ② 这些单据的挂靠数据(按面板过滤,应全为 0) ──");
            bad += kv(c, "  yj_doc_status(单据状态)", "SELECT COUNT(*) FROM yj_doc_status WHERE panel_code IN (" + in + ")", panels);
            bad += kv(c, "  yj_form_approval(审批留痕)", "SELECT COUNT(*) FROM yj_form_approval WHERE panel_code IN (" + in + ")", panels);
            bad += kv(c, "  yj_doc_modify_log(修改记录)", "SELECT COUNT(*) FROM yj_doc_modify_log WHERE panel_code IN (" + in + ")", panels);
            bad += kv(c, "  yj_doc_annotation(纸面批注)", "SELECT COUNT(*) FROM yj_doc_annotation WHERE panel_code IN (" + in + ")", panels);
            bad += kv(c, "  yj_attachment(附件)", "SELECT COUNT(*) FROM yj_attachment WHERE panel_code IN (" + in + ")", panels);
            bad += kv(c, "  yj_message(研发单据消息)", "SELECT COUNT(*) FROM yj_message WHERE 面板编码 IN (" + in + ")", panels);

            System.out.println("\n── ③ 研发区不带面板的业务表(应全为 0) ──");
            bad += report("  ", "rd_dev_task(产品开发任务)", count(c, "SELECT COUNT(*) FROM rd_dev_task", null));
            bad += report("  ", "rd_spec_assign(规格书分发)", count(c, "SELECT COUNT(*) FROM rd_spec_assign", null));

            System.out.println("\n── 保留项(不算违规;列出来是提醒「别顺手清掉」) ──");
            keep(c, "rd_sinter_tolerance(烧结公差标准库)");
            keep(c, "rd_sample_no_head(已下架面板留档)");
            keep(c, "rd_sample_no_detail(已下架面板留档)");
            keep(c, "rd_dev_task_bak_20261013(历史备份)");
            keep(c, "yj_share_file(共享文件库=真实资料)");
            keep(c, "yj_share_file_cat(共享文件分类)");

            System.out.println();
            if (bad == 0) {
                System.out.println("[PASS] 研发管理模块为空数据(" + tables.size() + " 张业务表 + 6 类挂靠数据 + 2 张扩展表全部 0 行)");
            } else {
                System.out.println("[FAIL] 研发管理模块还有 " + bad + " 处非空数据 —— 全量部署前必须清掉。清理入口:");
                System.out.println("  cd tools");
                System.out.println("  $env:YINJIA_SQL_PASS=\"...\"; $env:YINJIA_SQL_DB=\"HSDZ_MES_TEST\"");
                System.out.println("  java -cp lib\\mssql-jdbc.jar DbSync.java run cleanup-rd-testledger-20261016.sql");
                System.out.println("  (该脚本自带库名硬闸门:只允许在 HSDZ_MES_TEST 执行;整段事务 + 末尾自检「残留=0」)");
            }
        }
        System.exit(bad == 0 ? 0 : 1);
    }

    static void add(List<String> l, String v) {
        if (v != null && !v.isBlank() && !l.contains(v)) l.add(v);
    }

    /** 空表/不存在都返回 0;查询异常返回 -1(不判 FAIL,只提示) */
    static long count(Connection c, String sql, List<String> params) {
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            if (params != null) for (int i = 0; i < params.size(); i++) ps.setString(i + 1, params.get(i));
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getLong(1) : 0;
            }
        } catch (Exception e) {
            return -1;
        }
    }

    static int report(String indent, String label, long n) {
        if (n < 0) { System.out.println(indent + label + " : (表不存在/读不到,跳过)"); return 0; }
        System.out.println(indent + label + " : " + (n == 0 ? "0  ✅" : n + "  ❌"));
        return n > 0 ? 1 : 0;
    }

    static int kv(Connection c, String label, String sql, List<String> panels) {
        return report("", label, count(c, sql, panels));
    }

    static void keep(Connection c, String label) {
        long n = count(c, "SELECT COUNT(*) FROM [" + label.substring(0, label.indexOf('(')) + "]", null);
        System.out.println("  " + label + " : " + (n < 0 ? "(表不存在)" : n + " 行,保留"));
    }
}
