package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.PanelPermissionService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 工单排产·列表(2026-09-24,参考旧系统 ProSchedulingController 工单排产列表页):
 * ①/workOrderList 生产工单按**参考库 plang 表**展开(2026-09-24 用户拍板切源:外部系统直接写 plang,
 *   键=公司代码 comm + 工单号 pl_no + 工单行号 pl_xc;一单一行=一行,多行工单按 pl_xc 多行);
 *   条件:日期从/到(pl_date) + 单框模糊搜索(keyword,工单号/物料编码/产品名称/客户代码/客户名称 多列 OR);
 * ②/workOrderBom 产品的默认 BOM 明细(操作列「BOM明细」弹窗,参照 bs_bom 与 WoPickingHandler 同口径);
 * ③/printStamp 打印生产任务单留痕(plang.asp_print+1、打印人/打印时间;修复原版从 scheduled('') 取数
 *   永远匹配不到已排产工单的缺陷——现直接打印列表勾选行,不再回查排产明细);
 * ④/close 结案/取消结案(plang.ja,参考库 T/Y 归一为 Y/N)。
 * 定位(2026-09-26 用户拍板):生产工单=**纯查询+打印**,不作为快速排产任务——/reassign 批量调线已移除。
 * 权限:查看=登录即可(列表只读);写操作挂 MANU_ORDER(打印=打印按钮,结案=保存词表)。
 */
@RestController
@RequestMapping("/api/px")
public class WorkOrderListController {

    private final JdbcTemplate jdbc;
    private final PanelPermissionService perm;

    public WorkOrderListController(JdbcTemplate jdbc, PanelPermissionService perm) {
        this.jdbc = jdbc;
        this.perm = perm;
    }

    /** 工单行键:公司代码+工单号+工单行号+批次号(plang 行键;批次号=转单日期 yyyyMMdd,同日同批累加) */
    private record Key(String comm, String no, Integer xc, String batch) {
        static Key of(Map<String, Object> r) {
            String comm = str(r.get("公司代码"));
            String no = str(r.get("工单号"));
            Integer xc = null;
            Object x = r.get("工单行号");
            if (x instanceof Number n) xc = n.intValue();
            else if (x != null && !String.valueOf(x).isBlank()) {
                try { xc = Integer.valueOf(String.valueOf(x).trim()); } catch (NumberFormatException ignore) { }
            }
            String batch = str(r.get("批次号"));
            return new Key(comm == null ? "" : comm, no, xc, batch == null ? "" : batch);
        }

        boolean valid() { return no != null && !no.isBlank(); }

        String label() { return no + (xc == null ? "" : "#" + xc) + (batch == null || batch.isBlank() ? "" : "/" + batch); }
    }

    @PostMapping("/workOrderList")
    public ApiResult<List<Map<String, Object>>> list(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> b = body == null ? Map.of() : body;
        List<Object> args = new ArrayList<>();
        StringBuilder w = new StringBuilder(" WHERE ISNULL(p.asp_cancel,'N') <> 'Y'");
        if (b.get("日期从") != null && !String.valueOf(b.get("日期从")).isBlank()) {
            w.append(" AND p.pl_date >= ?");
            args.add(String.valueOf(b.get("日期从")));
        }
        if (b.get("日期到") != null && !String.valueOf(b.get("日期到")).isBlank()) {
            // pl_date 是 datetime,「到」含当日全天(< 次日零点),对齐旧 date 型列的 <= 语义
            w.append(" AND p.pl_date < DATEADD(day, 1, ?)");
            args.add(String.valueOf(b.get("日期到")));
        }
        // 单框模糊搜索(2026-09-26 用户拍板):关键字在 工单号/物料编码/产品名称/客户代码/客户名称 多列 OR
        String kw = b.get("keyword") == null ? "" : String.valueOf(b.get("keyword")).trim();
        if (!kw.isEmpty()) {
            String like = "%" + kw + "%";
            w.append(" AND (p.pl_no LIKE ? OR p.dm LIKE ? OR p.mc LIKE ? OR p.khdm LIKE ? OR ISNULL(dk.mc,N'') LIKE ?)");
            for (int i = 0; i < 5; i++) args.add(like);
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT p.comm AS 公司代码, p.pl_no AS 工单号, p.pl_xc AS 工单行号,"
                        + " ISNULL(p.[批次号], N'') AS 批次号,"
                        + " p.pl_no AS 加工单号, p.pl_xc AS 行id, p.pl_xc AS 行号,"
                        + " CONVERT(varchar(10), p.pl_date, 120) AS 单据日期,"
                        + " ISNULL(dk.mc, p.khdm) AS 客户, ISNULL(p.khdm, N'') AS 客户代码,"
                        + " ISNULL(p.scx, N'') AS 生产线,"
                        + " ISNULL(p.[打印人], N'') AS 打印人, CONVERT(varchar(16), p.[打印时间], 120) AS 打印时间,"
                        + " CASE WHEN p.ja IN (N'T', N'Y') THEN N'Y' ELSE N'N' END AS 结案,"
                        + " p.dm AS 物料编码, ISNULL(p.mc, N'') AS 产品名称, ISNULL(p.gg, N'') AS 规格型号,"
                        + " ISNULL(p.jldw, N'') AS 生产单位,"
                        + " ISNULL(p.pl_sl, 0) AS 排产数量, ISNULL(p.xq_sl, 0) AS 需求数量, ISNULL(p.rk_sl, 0) AS 入库数量,"
                        + " ISNULL(p.pl_sl, 0) - ISNULL(p.rk_sl, 0) AS 余量,"
                        + " ISNULL(管控.重点管控, N'否') AS 重点管控,"
                        + " ISNULL(p.ll_no2, N'') AS 领料单号, ISNULL(p.lot_no, N'') AS 批号,"
                        + " CONVERT(varchar(10), p.cp_date, 120) AS 计划完工日期,"
                        + " CAST(ISNULL(CAST(p.bz AS nvarchar(500)), N'') AS nvarchar(500)) AS 备注"
                        + " FROM dbo.plang p"
                        + " LEFT JOIN dbo.dm_kh dk ON dk.comm = p.comm AND dk.dm = p.khdm"
                        + " LEFT JOIN (SELECT iv.存货编码, MAX(CASE WHEN iv.商品标签 LIKE N'%重点%' THEN N'是' ELSE N'否' END) AS 重点管控"
                        + "            FROM bs_inv iv GROUP BY iv.存货编码) 管控 ON 管控.存货编码 = p.dm"
                        + w + " ORDER BY p.pl_date DESC, p.pl_no, p.pl_xc",
                args.toArray());
        // 生产状态(与 v_manu_schedule 同口径:完工=入库≥排产;在产=有入库;其余未完工)
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Map<String, Object> m = new LinkedHashMap<>(r);
            double sched = ((Number) r.getOrDefault("排产数量", 0)).doubleValue();
            double in = ((Number) r.getOrDefault("入库数量", 0)).doubleValue();
            m.put("生产状态", sched > 0 && in >= sched ? "完工" : (in > 0 ? "在产" : "未完工"));
            out.add(m);
        }
        return ApiResult.ok(out);
    }

    @PostMapping("/workOrderBom")
    public ApiResult<List<Map<String, Object>>> bom(@RequestBody Map<String, Object> body) {
        String product = body.get("产品编码") == null ? "" : String.valueOf(body.get("产品编码")).trim();
        if (product.isBlank()) return ApiResult.ok(List.of());
        return ApiResult.ok(jdbc.queryForList(
                "SELECT [子件编码], [子件名称], [规格型号], [子件计量单位], [定额数量], 1 AS [层级]"
                        + " FROM bs_bom WHERE [父件编码] = ? AND ISNULL([默认BOM],0) = 1"
                        + " AND ISNULL([状态], N'启用') = N'启用' AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + " AND [子件编码] IS NOT NULL ORDER BY id", product));
    }

    /** 打印生产任务单留痕:plang.asp_print+1、打印人/打印时间(权限=MANU_ORDER 打印) */
    @PostMapping("/workOrderList/printStamp")
    public ApiResult<Map<String, Object>> printStamp(@RequestBody Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        perm.requireButton("MANU_ORDER", "打印");
        List<Map<String, Object>> rows = castRows(body.get("rows"));
        if (rows.isEmpty()) throw new IllegalArgumentException("请先勾选要打印的工单");
        String user = currentUser();
        List<String> done = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Key k = Key.of(r);
            if (!k.valid()) continue;
            int n = jdbc.update("UPDATE dbo.plang SET asp_print = ISNULL(asp_print,0) + 1,"
                            + " [打印人]=?, [打印时间]=SYSDATETIME()"
                            + " WHERE comm=? AND pl_no=? AND pl_xc=?"
                            + " AND ((? = N'' AND [批次号] IS NULL) OR [批次号] = ?)"
                            + " AND ISNULL(asp_cancel,'N')<>'Y'",
                    user, k.comm(), k.no(), k.xc(), k.batch(), k.batch());
            if (n > 0) done.add(k.label());
        }
        if (done.isEmpty()) throw new IllegalStateException("无可打印的工单(plang 中未找到)");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("打印张数", done.size());
        out.put("单号清单", done);
        return ApiResult.ok(out);
    }

    /** 结案/取消结案:plang.ja=Y/N(参考库 T/Y 归一);留痕 yj_usage_log */
    @PostMapping("/workOrderList/close")
    public ApiResult<Map<String, Object>> close(@RequestBody Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        perm.requireButton("MANU_ORDER", "保存");
        boolean close = !"false".equals(String.valueOf(body.get("结案")));
        List<Map<String, Object>> rows = castRows(body.get("rows"));
        if (rows.isEmpty()) throw new IllegalArgumentException(close ? "请先勾选要结案的工单" : "请先勾选要取消结案的工单");
        String user = currentUser();
        List<String> done = new ArrayList<>();
        List<String> failed = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Key k = Key.of(r);
            if (!k.valid()) continue;
            try {
                int n = jdbc.update("UPDATE dbo.plang SET ja = ? WHERE comm=? AND pl_no=? AND pl_xc=?"
                                + " AND ((? = N'' AND [批次号] IS NULL) OR [批次号] = ?)"
                                + " AND ISNULL(asp_cancel,'N')<>'Y'",
                        close ? "Y" : "N", k.comm(), k.no(), k.xc(), k.batch(), k.batch());
                if (n == 0) throw new IllegalStateException("plang 中未找到");
                logUsage(user, close ? "结案" : "取消结案", k.no());
                done.add(k.label());
            } catch (IllegalStateException e) {
                failed.add(k.no() + ":" + e.getMessage());
            }
        }
        if (done.isEmpty()) throw new IllegalStateException("无行可操作:" + String.join("; ", failed));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put(close ? "结案张数" : "取消结案张数", done.size());
        out.put("单号清单", done);
        out.put("失败行", failed);
        return ApiResult.ok(out);
    }

    /** 批量调线端点已移除(2026-09-26 用户拍板:生产工单=纯查询+打印,不作为快速排产任务) */

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> castRows(Object o) {
        if (o instanceof List<?> l) return (List<Map<String, Object>>) l;
        return List.of();
    }

    /**
     * 按钮留痕(yj_usage_log)。real_name 非空:从 yj_user 取,查不到回落登录名;
     * 留痕失败不阻断业务(口径同 ScheduleBoardService,但显式补齐 real_name 根因)。
     */
    private void logUsage(String user, String action, String docNo) {
        try {
            jdbc.update("INSERT INTO yj_usage_log (user_name, real_name, event_type, panel_name, action_name, doc_no, created_at)"
                            + " VALUES (?, ISNULL((SELECT real_name FROM yj_user WHERE username = ?), ?),"
                            + " N'工单', N'生产工单', ?, ?, GETDATE())",
                    user, user, user, action, docNo);
        } catch (Exception ignore) { /* 留痕不阻断业务 */ }
    }

    private static String currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? "system" : auth.getName();
    }

    private static String str(Object o) {
        if (o == null) return null;
        String s = String.valueOf(o).trim();
        return s.isBlank() ? null : s;
    }
}
