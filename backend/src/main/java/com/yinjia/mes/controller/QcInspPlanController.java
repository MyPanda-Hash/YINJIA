package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.PanelPermissionService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 检验项目 / 检验方案 **维护**接口(2026-10-09,用户口径:「给出一个按钮,让他可以在组装成品检验处
 * 对这个检验项目和检验方案进行维护」)。
 *
 * <p>落点是两张既有基础档案(此前一直是空表,不是新表):
 * <ul>
 *   <li>{@code bs_qc_plan} 检验方案(头)= 适用存货/类别 + 检验方式 + 抽检比例 + 取样规则 + 文件编码/执行标准;</li>
 *   <li>{@code bs_qc_item} 检验项目(行)= 项目编码/名称 + 检验内容/标准 + 判定规则 + 上下限 + 取样要求/检验方法 + 合格·不合格处置;
 *       **方案编码**把它挂在某个方案下(方案 1..N 项目)。</li>
 * </ul>
 *
 * <p>⚠ 口径:本接口只维护**标准本身**,不往任何检验单写数据,也不改动已录入的单据
 * (检验单上存的是文本,不存条目 id)。这与 {@code StdLibController} 的"改库不污染已录入数据"同口径。
 *
 * <p>权限:读=QC_ASM_INSP 可见;写=同上(维护标准库属品质日常,与 StdLibController 同级别,
 * 比它多一道面板可见性闸门)。
 */
@RestController
@RequestMapping("/api/qc/inspPlan")
public class QcInspPlanController {

    /** 权限锚点:维护入口挂在组装成品检验单上,故以它的可见性为准 */
    private static final String PANEL = "QC_ASM_INSP";

    private final JdbcTemplate jdbc;
    private final PanelPermissionService perm;

    public QcInspPlanController(JdbcTemplate jdbc, PanelPermissionService perm) {
        this.jdbc = jdbc;
        this.perm = perm;
    }

    // ══════════════════════════ 方案 ══════════════════════════

    /**
     * 方案列表:GET /plans?keyword=&all=1。
     * all=1 连**停用**方案一起下发并带 enabled(维护界面要显示灰显行并恢复启用);默认只给启用。
     */
    @GetMapping("/plans")
    public ApiResult<List<Map<String, Object>>> plans(@RequestParam(required = false) String keyword,
                                                      @RequestParam(required = false) String all) {
        perm.requirePanelView(PANEL);
        boolean withDisabled = truthy(all);
        StringBuilder sql = new StringBuilder(
                "SELECT id, 方案编码, 方案名称, ISNULL(适用存货,N'') AS 适用存货,"
                        + " ISNULL(适用存货类别,N'') AS 适用存货类别, ISNULL(检验方式,N'') AS 检验方式,"
                        + " [抽检比例%] AS 抽检比例, ISNULL(取样规则,N'') AS 取样规则,"
                        + " ISNULL(文件编码,N'') AS 文件编码, ISNULL(执行标准,N'') AS 执行标准,"
                        + " ISNULL(备注,N'') AS 备注, ISNULL(停用,0) AS 停用,"
                        + " CASE WHEN ISNULL(停用,0)=1 THEN 0 ELSE 1 END AS enabled,"
                        + " (SELECT COUNT(*) FROM dbo.bs_qc_item i WHERE i.方案编码 = p.方案编码"
                        + "    AND ISNULL(i.asp_cancel,'N')<>'Y') AS 项目数"
                        + " FROM dbo.bs_qc_plan p WHERE ISNULL(p.asp_cancel,'N')<>'Y'");
        List<Object> args = new ArrayList<>();
        if (!withDisabled) sql.append(" AND ISNULL(p.停用,0)=0");
        if (keyword != null && !keyword.isBlank()) {
            sql.append(" AND (p.方案编码 LIKE ? OR p.方案名称 LIKE ? OR ISNULL(p.适用存货,N'') LIKE ?)");
            String like = "%" + keyword.trim() + "%";
            args.add(like); args.add(like); args.add(like);
        }
        sql.append(" ORDER BY ISNULL(p.停用,0), p.方案编码, p.id");
        return ApiResult.ok(jdbc.queryForList(sql.toString(), args.toArray()));
    }

    /** 新增/修改方案:POST {id?, 方案编码, 方案名称, 适用存货, 适用存货类别, 检验方式, 抽检比例, 取样规则, 文件编码, 执行标准, 备注} */
    @PostMapping("/planSave")
    public ApiResult<Map<String, Object>> planSave(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PANEL);
        String user = currentUser();
        String code = str(body.get("方案编码"));
        String name = str(body.get("方案名称"));
        if (code.isBlank()) return ApiResult.error(400, "方案编码不能为空");
        if (name.isBlank()) return ApiResult.error(400, "方案名称不能为空");
        Long id = lng(body.get("id"));
        // 编码唯一(同编码只能有一条存活方案):新增撞码、或改名撞到别人,都要拦
        Integer dup = jdbc.queryForObject(
                "SELECT COUNT(*) FROM dbo.bs_qc_plan WHERE 方案编码=? AND ISNULL(asp_cancel,'N')<>'Y' AND id<>?",
                Integer.class, code, id == null ? -1L : id);
        if (dup != null && dup > 0) return ApiResult.error(400, "方案编码已存在:" + code);

        Object[] vals = {
                code, name, nn(body.get("适用存货")), nn(body.get("适用存货类别")),
                nv(body.get("检验方式"), "抽检"), dec(body.get("抽检比例")),
                nn(body.get("取样规则")), nn(body.get("文件编码")), nn(body.get("执行标准")),
                nn(body.get("备注")), user};
        if (id == null) {
            jdbc.update("INSERT INTO dbo.bs_qc_plan (方案编码, 方案名称, 适用存货, 适用存货类别, 检验方式, [抽检比例%],"
                            + " 取样规则, 文件编码, 执行标准, 备注, 状态, asp_user1, asp_time1)"
                            + " VALUES (?,?,?,?,?,?,?,?,?,?, N'启用', ?, SYSDATETIME())", vals);
            id = jdbc.queryForObject("SELECT MAX(id) FROM dbo.bs_qc_plan WHERE 方案编码=?", Long.class, code);
        } else {
            jdbc.update("UPDATE dbo.bs_qc_plan SET 方案编码=?, 方案名称=?, 适用存货=?, 适用存货类别=?, 检验方式=?,"
                            + " [抽检比例%]=?, 取样规则=?, 文件编码=?, 执行标准=?, 备注=?, asp_user2=?, asp_time2=SYSDATETIME()"
                            + " WHERE id=?", vals[0], vals[1], vals[2], vals[3], vals[4], vals[5], vals[6], vals[7],
                    vals[8], vals[9], user, id);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("方案编码", code);
        return ApiResult.ok(out);
    }

    /** 停用方案(软删;可恢复):POST {id} */
    @PostMapping("/planRemove")
    public ApiResult<Map<String, Object>> planRemove(@RequestBody Map<String, Object> body) {
        return planSetEnabled(body, 1);
    }

    /** 恢复启用方案:POST {id} */
    @PostMapping("/planEnable")
    public ApiResult<Map<String, Object>> planEnable(@RequestBody Map<String, Object> body) {
        return planSetEnabled(body, 0);
    }

    private ApiResult<Map<String, Object>> planSetEnabled(Map<String, Object> body, int disabled) {
        perm.requirePanelView(PANEL);
        Long id = lng(body.get("id"));
        if (id == null) return ApiResult.error(400, "id 无效");
        int n = jdbc.update("UPDATE dbo.bs_qc_plan SET 停用=?, asp_user2=?, asp_time2=SYSDATETIME()"
                + " WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'", disabled, currentUser(), id);
        if (n == 0) return ApiResult.error(404, "方案不存在或已删除");
        return ApiResult.ok(Map.of("id", id, "停用", disabled));
    }

    // ══════════════════════════ 检验项目 ══════════════════════════

    /** 项目列表:GET /items?planCode=QP-CAS18&all=1(不带 planCode = 全部存活项目) */
    @GetMapping("/items")
    public ApiResult<List<Map<String, Object>>> items(@RequestParam(required = false) String planCode,
                                                      @RequestParam(required = false) String all) {
        perm.requirePanelView(PANEL);
        boolean withDisabled = truthy(all);
        StringBuilder sql = new StringBuilder(
                "SELECT id, ISNULL(方案编码,N'') AS 方案编码, ISNULL(序号,0) AS 序号,"
                        + " 项目编码, 项目名称, 检验内容, 检验标准, 数据类型, ISNULL(计量单位,N'') AS 计量单位,"
                        + " 判定规则, 标准下限, 标准上限, ISNULL(取样要求,N'') AS 取样要求,"
                        + " ISNULL(检验方法,N'') AS 检验方法, ISNULL(合格处置,N'') AS 合格处置,"
                        + " ISNULL(不合格处置,N'') AS 不合格处置, ISNULL(备注,N'') AS 备注,"
                        + " ISNULL(停用,0) AS 停用, CASE WHEN ISNULL(停用,0)=1 THEN 0 ELSE 1 END AS enabled"
                        + " FROM dbo.bs_qc_item WHERE ISNULL(asp_cancel,'N')<>'Y'");
        List<Object> args = new ArrayList<>();
        if (!withDisabled) sql.append(" AND ISNULL(停用,0)=0");
        if (planCode != null && !planCode.isBlank()) {
            sql.append(" AND 方案编码 = ?");
            args.add(planCode.trim());
        }
        sql.append(" ORDER BY ISNULL(停用,0), ISNULL(序号,9999), id");
        return ApiResult.ok(jdbc.queryForList(sql.toString(), args.toArray()));
    }

    /** 新增/修改检验项目:POST {id?, 方案编码, 序号, 项目编码, 项目名称, 检验内容, 检验标准, 数据类型, 计量单位, 判定规则, 标准下限, 标准上限, 取样要求, 检验方法, 合格处置, 不合格处置, 备注} */
    @PostMapping("/itemSave")
    public ApiResult<Map<String, Object>> itemSave(@RequestBody Map<String, Object> body) {
        perm.requirePanelView(PANEL);
        String user = currentUser();
        String code = str(body.get("项目编码"));
        String name = str(body.get("项目名称"));
        if (code.isBlank()) return ApiResult.error(400, "项目编码不能为空");
        if (name.isBlank()) return ApiResult.error(400, "项目名称不能为空");
        // 三列物理 NOT NULL:缺省给业务可读的兜底,避免"界面看着能存、库里报错"
        String content = nv(body.get("检验内容"), name);
        String standard = nv(body.get("检验标准"), "");
        if (standard.isBlank()) return ApiResult.error(400, "检验标准不能为空");
        String dataType = nv(body.get("数据类型"), "定量");
        String rule = nv(body.get("判定规则"), "符合标准");
        Long id = lng(body.get("id"));
        Integer dup = jdbc.queryForObject(
                "SELECT COUNT(*) FROM dbo.bs_qc_item WHERE 项目编码=? AND ISNULL(asp_cancel,'N')<>'Y' AND id<>?",
                Integer.class, code, id == null ? -1L : id);
        if (dup != null && dup > 0) return ApiResult.error(400, "项目编码已存在:" + code);
        Object[] v = {nn(body.get("方案编码")), lngOrNull(body.get("序号")), code, name, content, standard, dataType,
                nn(body.get("计量单位")), rule, dec(body.get("标准下限")), dec(body.get("标准上限")),
                nn(body.get("取样要求")), nn(body.get("检验方法")), nn(body.get("合格处置")),
                nn(body.get("不合格处置")), nn(body.get("备注"))};
        if (id == null) {
            jdbc.update("INSERT INTO dbo.bs_qc_item (方案编码, 序号, 项目编码, 项目名称, 检验内容, 检验标准, 数据类型,"
                            + " 计量单位, 判定规则, 标准下限, 标准上限, 取样要求, 检验方法, 合格处置, 不合格处置, 备注,"
                            + " 状态, asp_user1, asp_time1)"
                            + " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, N'启用', ?, SYSDATETIME())",
                    v[0], v[1], v[2], v[3], v[4], v[5], v[6], v[7], v[8], v[9], v[10], v[11], v[12], v[13], v[14], v[15], user);
            id = jdbc.queryForObject("SELECT MAX(id) FROM dbo.bs_qc_item WHERE 项目编码=?", Long.class, code);
        } else {
            jdbc.update("UPDATE dbo.bs_qc_item SET 方案编码=?, 序号=?, 项目编码=?, 项目名称=?, 检验内容=?, 检验标准=?,"
                            + " 数据类型=?, 计量单位=?, 判定规则=?, 标准下限=?, 标准上限=?, 取样要求=?, 检验方法=?,"
                            + " 合格处置=?, 不合格处置=?, 备注=?, asp_user2=?, asp_time2=SYSDATETIME() WHERE id=?",
                    v[0], v[1], v[2], v[3], v[4], v[5], v[6], v[7], v[8], v[9], v[10], v[11], v[12], v[13], v[14], v[15],
                    user, id);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("项目编码", code);
        return ApiResult.ok(out);
    }

    /** 停用检验项目(软删;可恢复):POST {id} */
    @PostMapping("/itemRemove")
    public ApiResult<Map<String, Object>> itemRemove(@RequestBody Map<String, Object> body) {
        return itemSetEnabled(body, 1);
    }

    /** 恢复启用检验项目:POST {id} */
    @PostMapping("/itemEnable")
    public ApiResult<Map<String, Object>> itemEnable(@RequestBody Map<String, Object> body) {
        return itemSetEnabled(body, 0);
    }

    private ApiResult<Map<String, Object>> itemSetEnabled(Map<String, Object> body, int disabled) {
        perm.requirePanelView(PANEL);
        Long id = lng(body.get("id"));
        if (id == null) return ApiResult.error(400, "id 无效");
        int n = jdbc.update("UPDATE dbo.bs_qc_item SET 停用=?, asp_user2=?, asp_time2=SYSDATETIME()"
                + " WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'", disabled, currentUser(), id);
        if (n == 0) return ApiResult.error(404, "检验项目不存在或已删除");
        return ApiResult.ok(Map.of("id", id, "停用", disabled));
    }

    // ══════════════════════════ 小工具 ══════════════════════════

    private static boolean truthy(String s) {
        return s != null && !s.isBlank() && !"0".equals(s) && !"false".equalsIgnoreCase(s);
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    /** 必填文本:空 → 原样空串(交给上层校验) */
    private static String nv(Object o, String dft) {
        String s = str(o);
        return s.isEmpty() ? dft : s;
    }

    /** 可空文本:空 → null(库里存 NULL 而不是空串) */
    private static String nn(Object o) {
        String s = str(o);
        return s.isEmpty() ? null : s;
    }

    private static Integer lngOrNull(Object o) {
        Long v = lng(o);
        return v == null ? null : v.intValue();
    }

    private static Long lng(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.longValue();
        String s = String.valueOf(o).trim();
        if (s.isEmpty()) return null;
        try { return Long.valueOf(s); } catch (NumberFormatException e) { return null; }
    }

    private static java.math.BigDecimal dec(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return new java.math.BigDecimal(n.toString());
        String s = String.valueOf(o).trim();
        if (s.isEmpty()) return null;
        try { return new java.math.BigDecimal(s); } catch (NumberFormatException e) { return null; }
    }

    private static String currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? "system" : auth.getName();
    }
}
