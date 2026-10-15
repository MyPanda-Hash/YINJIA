package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.PanelPermissionService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
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
 *   <li>{@code bs_qc_plan} 检验方案(头)= 适用存货/类别 + 检验方式 + 抽检比例 + 取样规则 + <b>检验类型</b>/执行标准;
 *       <b>检验类型</b>(项目分类,如 外观检测/重量检测,2026-10-16 起)= 一个方案 = 一类项目,
 *       带入检验单横表时作「表区」名;原「文件编码」已退场(yj_field 隐藏,值保留);</li>
 *   <li>{@code bs_qc_item} 检验项目(行)= 项目编码/名称 + 检验内容/标准 + 判定规则 + 上下限 + 取样要求/检验方法 + 合格·不合格处置
 *       + <b>检验数量</b>(可选,2026-10-16 起:带入后横表该列的初始格数,也是列头「＋」的上限);
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

    /**
     * 权限锚点:维护入口挂在各张工序检验单上,故「任一检验单可见」即可。
     *
     * <p>2026-10-12:原为单一 {@code QC_ASM_INSP}。制程检验单 QC_PROC_INSP 也要用同一个
     * 「检验项目设定」弹窗(用户口径:不同检验项目类别自动分格带出明细),故改为集合 ——
     * 只要用户能看见其中任意一张检验单,就有权读写这套检验标准库。
     */
    private static final java.util.List<String> PANELS =
            java.util.List.of("QC_ASM_INSP", "QC_MOLD_INSP", "QC_CUT_INSP", "QC_PROC_INSP");

    /** 任一检验单可见即放行 */
    private void requireAnyPanelView() {
        RuntimeException last = null;
        for (String p : PANELS) {
            try {
                perm.requirePanelView(p);
                return;
            } catch (RuntimeException e) {
                last = e;
            }
        }
        throw last != null ? last : new IllegalStateException("无权访问检验标准库");
    }

    /** 权限锚点(兼容旧调用点):保留原常量名,指向主入口 */
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
     *
     * <p>2026-10-16:下发字段由「文件编码」换成「检验类型」(用户口径「不需要绑定文件编码,
     * 而是设定当前检验的类型」)—— 文件编码列还在库里(老方案的值原样留着),只是不再进界面。
     */
    @GetMapping("/plans")
    public ApiResult<List<Map<String, Object>>> plans(@RequestParam(required = false) String keyword,
                                                      @RequestParam(required = false) String all) {
        requireAnyPanelView();
        boolean withDisabled = truthy(all);
        StringBuilder sql = new StringBuilder(
                "SELECT id, 方案编码, 方案名称, ISNULL(适用存货,N'') AS 适用存货,"
                        + " ISNULL(适用存货类别,N'') AS 适用存货类别, ISNULL(检验方式,N'') AS 检验方式,"
                        + " [抽检比例%] AS 抽检比例, ISNULL(取样规则,N'') AS 取样规则,"
                        + " ISNULL(检验类型,N'') AS 检验类型, ISNULL(执行标准,N'') AS 执行标准,"
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

    /** 新增/修改方案:POST {id?, 方案编码, 方案名称, 适用存货, 适用存货类别, 检验方式, 抽检比例, 取样规则, 检验类型, 执行标准, 备注} */
    @PostMapping("/planSave")
    public ApiResult<Map<String, Object>> planSave(@RequestBody Map<String, Object> body) {
        requireAnyPanelView();
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

        // ⚠ 文件编码已退场(2026-10-16):INSERT 不再写它(留 NULL)、UPDATE 也不碰它
        //   —— 老方案上已填的受控文件号原样留在库里,不因维护动作被清空。
        Object[] vals = {
                code, name, nn(body.get("适用存货")), nn(body.get("适用存货类别")),
                nv(body.get("检验方式"), "抽检"), dec(body.get("抽检比例")),
                nn(body.get("取样规则")), nn(body.get("检验类型")), nn(body.get("执行标准")),
                nn(body.get("备注")), user};
        if (id == null) {
            jdbc.update("INSERT INTO dbo.bs_qc_plan (方案编码, 方案名称, 适用存货, 适用存货类别, 检验方式, [抽检比例%],"
                            + " 取样规则, 检验类型, 执行标准, 备注, 状态, asp_user1, asp_time1)"
                            + " VALUES (?,?,?,?,?,?,?,?,?,?, N'启用', ?, SYSDATETIME())", vals);
            id = jdbc.queryForObject("SELECT MAX(id) FROM dbo.bs_qc_plan WHERE 方案编码=?", Long.class, code);
        } else {
            jdbc.update("UPDATE dbo.bs_qc_plan SET 方案编码=?, 方案名称=?, 适用存货=?, 适用存货类别=?, 检验方式=?,"
                            + " [抽检比例%]=?, 取样规则=?, 检验类型=?, 执行标准=?, 备注=?, asp_user2=?, asp_time2=SYSDATETIME()"
                            + " WHERE id=?", vals[0], vals[1], vals[2], vals[3], vals[4], vals[5], vals[6], vals[7],
                    vals[8], vals[9], user, id);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("方案编码", code);
        return ApiResult.ok(out);
    }

    /**
     * **彻底删除方案**(物理删,连同其下检验项目):POST {id}。
     *
     * <p>2026-10-15 用户口径:「检验项目需要能实现删除,不能只可增加不可删除」——
     * 维护弹窗此前只有「停用」(软删,列表里仍留灰行),想清掉建错的方案/项目没有出口。
     * 本接口与 {@code StdLibController#destroy} 的 🗑「彻底删除」同口径:**物理删,不可恢复**。
     *
     * <p>连带删掉该方案下的全部检验项目(方案 1..N 项目,方案编码是唯一的归属键)——
     * 前端确认框会把「将一并删除 N 个检验项目」说清楚再执行。
     *
     * <p>⚠ 不影响已录入单据:检验单的检验项目是**文本快照**(带入明细时只写文本,不存条目 id),
     * 全库无任何表按 id 引用这两张库表(2026-10-15 全仓核对)。
     */
    @PostMapping("/planDestroy")
    @Transactional
    public ApiResult<Map<String, Object>> planDestroy(@RequestBody Map<String, Object> body) {
        requireAnyPanelView();
        Long id = lng(body.get("id"));
        if (id == null) return ApiResult.error(400, "id 无效");
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT 方案编码 FROM dbo.bs_qc_plan WHERE id=?", id);
        if (rows.isEmpty()) return ApiResult.error(404, "检验方案不存在或已删除");
        String code = str(rows.get(0).get("方案编码"));
        int items = code.isEmpty() ? 0
                : jdbc.update("DELETE FROM dbo.bs_qc_item WHERE 方案编码=?", code);
        int plans = jdbc.update("DELETE FROM dbo.bs_qc_plan WHERE id=?", id);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("deleted", plans);
        out.put("items", items);
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
        requireAnyPanelView();
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
        requireAnyPanelView();
        boolean withDisabled = truthy(all);
        StringBuilder sql = new StringBuilder(
                "SELECT id, ISNULL(方案编码,N'') AS 方案编码, ISNULL(序号,0) AS 序号,"
                        + " 项目编码, 项目名称, 检验内容, 检验标准, 数据类型, ISNULL(计量单位,N'') AS 计量单位,"
                        + " 判定规则, 标准下限, 标准上限, ISNULL(取样要求,N'') AS 取样要求,"
                        + " 检验数量,"
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

    /** 新增/修改检验项目:POST {id?, 方案编码, 序号, 项目编码, 项目名称, 检验内容, 检验标准, 数据类型, 计量单位, 判定规则, 标准下限, 标准上限, 取样要求, 检验数量, 检验方法, 合格处置, 不合格处置, 备注} */
    @PostMapping("/itemSave")
    public ApiResult<Map<String, Object>> itemSave(@RequestBody Map<String, Object> body) {
        requireAnyPanelView();
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
                nn(body.get("取样要求")), lngOrNull(body.get("检验数量")), nn(body.get("检验方法")),
                nn(body.get("合格处置")), nn(body.get("不合格处置")), nn(body.get("备注"))};
        if (id == null) {
            jdbc.update("INSERT INTO dbo.bs_qc_item (方案编码, 序号, 项目编码, 项目名称, 检验内容, 检验标准, 数据类型,"
                            + " 计量单位, 判定规则, 标准下限, 标准上限, 取样要求, 检验数量, 检验方法, 合格处置, 不合格处置, 备注,"
                            + " 状态, asp_user1, asp_time1)"
                            + " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, N'启用', ?, SYSDATETIME())",
                    v[0], v[1], v[2], v[3], v[4], v[5], v[6], v[7], v[8], v[9], v[10], v[11], v[12], v[13], v[14], v[15], v[16], user);
            id = jdbc.queryForObject("SELECT MAX(id) FROM dbo.bs_qc_item WHERE 项目编码=?", Long.class, code);
        } else {
            jdbc.update("UPDATE dbo.bs_qc_item SET 方案编码=?, 序号=?, 项目编码=?, 项目名称=?, 检验内容=?, 检验标准=?,"
                            + " 数据类型=?, 计量单位=?, 判定规则=?, 标准下限=?, 标准上限=?, 取样要求=?, 检验数量=?, 检验方法=?,"
                            + " 合格处置=?, 不合格处置=?, 备注=?, asp_user2=?, asp_time2=SYSDATETIME() WHERE id=?",
                    v[0], v[1], v[2], v[3], v[4], v[5], v[6], v[7], v[8], v[9], v[10], v[11], v[12], v[13], v[14], v[15], v[16],
                    user, id);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("项目编码", code);
        return ApiResult.ok(out);
    }

    /**
     * **彻底删除检验项目**(物理删,不可恢复):POST {id} 或 {ids:[...]}(多选一次删)。
     *
     * <p>与「停用」的分工(2026-10-15 用户口径「不能只可增加不可删除」):
     * <ul>
     *   <li>停用 = 以后不再使用,但列表里留灰行、可恢复 —— 保留历史/暂缓用;</li>
     *   <li>删除 = 这条标准**建错了、不要了**,从库里彻底拿掉。</li>
     * </ul>
     * 两者都**不动已录入的检验单**(检验单存的是文本快照,不按 id 回查本表)。
     */
    @PostMapping("/itemDestroy")
    public ApiResult<Map<String, Object>> itemDestroy(@RequestBody Map<String, Object> body) {
        requireAnyPanelView();
        List<Long> ids = idList(body);
        if (ids.isEmpty()) return ApiResult.error(400, "请先选中或勾选要删除的检验项目");
        StringBuilder in = new StringBuilder();
        for (int i = 0; i < ids.size(); i++) in.append(i == 0 ? "?" : ",?");
        int n = jdbc.update("DELETE FROM dbo.bs_qc_item WHERE id IN (" + in + ")", ids.toArray());
        if (n == 0) return ApiResult.error(404, "检验项目不存在或已删除");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("deleted", n);
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
        requireAnyPanelView();
        Long id = lng(body.get("id"));
        if (id == null) return ApiResult.error(400, "id 无效");
        int n = jdbc.update("UPDATE dbo.bs_qc_item SET 停用=?, asp_user2=?, asp_time2=SYSDATETIME()"
                + " WHERE id=? AND ISNULL(asp_cancel,'N')<>'Y'", disabled, currentUser(), id);
        if (n == 0) return ApiResult.error(404, "检验项目不存在或已删除");
        return ApiResult.ok(Map.of("id", id, "停用", disabled));
    }

    // ══════════════════ 出货检验计划(RD_INSP_PLAN)→ 制程检验单 ══════════════════

    /**
     * 按**产品编码**取出货检验计划的检验项目,供制程检验单带入明细。
     *
     * <p>用户 2026-10-13 口径:「当前出货检验计划的内容能被当前制程检验单取到 —— 实现对应的
     * 产品编码就能获取到对应的检验内容进行填入」。
     * 该计划单(RD_INSP_PLAN,文档编号 YJ-RD001)四个红框里:</p>
     * <ul>
     *   <li>产品编号 = 关联键(制程检验单已有「产品编码」,不新增表头字段);</li>
     *   <li>检验要求 / 检验方法 = 制程检验单已有字段,直接映射;</li>
     *   <li>检查频率 = 本批迁移补的字段(映射 {@code 检测频率})。</li>
     * </ul>
     *
     * <p>字段映射:{@code 控制项目→检验项目 · 控制标准及要求→检验要求 · 控制方法→检验方法 ·
     * 检测频率→检查频率 · 检测仪器→检验仪器 · 不合格应对措施→同名 · 检验内容→表区}。</p>
     *
     * <p>同产品多张计划取**最新一张**(id 倒序),与系统既有「按产品找最新单据」口径一致。
     * 查不到不算错:返回 200 + 空 rows,由前端提示「该产品没有出货检验计划」。</p>
     */
    @GetMapping("/fromShipPlan")
    public ApiResult<Map<String, Object>> fromShipPlan(@RequestParam String productCode) {
        requireAnyPanelView();
        String code = str(productCode);
        if (code.isEmpty()) return ApiResult.error(400, "请先填写产品编码");

        List<Map<String, Object>> plans = jdbc.queryForList(
                "SELECT TOP 1 [单据编号] AS planNo, ISNULL([标题],N'') AS title,"
                        + " ISNULL([版本号],N'') AS version, ISNULL([客户项目名称],N'') AS customerProject,"
                        + " ISNULL([产品整体尺寸],N'') AS productSize"
                        + " FROM dbo.rd_insp_plan_head"
                        + " WHERE [产品编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + " ORDER BY id DESC", code);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("productCode", code);
        if (plans.isEmpty()) {
            out.put("planNo", null);
            out.put("rows", List.of());
            return ApiResult.ok(out);
        }
        Map<String, Object> plan = plans.get(0);
        String planNo = str(plan.get("planNo"));
        out.put("planNo", planNo);
        out.put("title", plan.get("title"));
        out.put("version", plan.get("version"));
        out.put("customerProject", plan.get("customerProject"));
        out.put("productSize", plan.get("productSize"));

        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT ISNULL([控制项目],N'') AS item, ISNULL([控制标准及要求],N'') AS req,"
                        + " ISNULL([控制方法],N'') AS method, ISNULL([检测频率],N'') AS freq,"
                        + " ISNULL([检测仪器],N'') AS instrument, ISNULL([不合格应对措施],N'') AS action,"
                        + " ISNULL([检验内容],N'') AS category"
                        + " FROM dbo.rd_insp_plan_detail"
                        + " WHERE [单据编号] = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + " ORDER BY ISNULL(TRY_CAST([序号] AS int), 999999), id", planNo);

        List<Map<String, Object>> mapped = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("表区", str(r.get("category")));            // RD_INSP_PLAN.检验内容 = 类别(决定分区)
            m.put("检验项目", str(r.get("item")));
            m.put("检验要求", str(r.get("req")));
            m.put("检验方法", str(r.get("method")));
            m.put("检查频率", str(r.get("freq")));
            m.put("检验仪器", str(r.get("instrument")));
            m.put("不合格应对措施", str(r.get("action")));
            mapped.add(m);
        }
        out.put("rows", mapped);
        return ApiResult.ok(out);
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

    /**
     * 取 id 集合:{ids:[1,2]} 或 {id:1}(单条)两种都收 ——
     * 弹窗「删除」既可删当前行(单条),也可删勾选的多行,后端一个入口收口。
     */
    private static List<Long> idList(Map<String, Object> body) {
        List<Long> out = new ArrayList<>();
        Object ids = body.get("ids");
        if (ids instanceof List<?> list) {
            for (Object o : list) {
                Long v = lng(o);
                if (v != null && !out.contains(v)) out.add(v);
            }
        }
        Long one = lng(body.get("id"));
        if (one != null && !out.contains(one)) out.add(one);
        return out;
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
