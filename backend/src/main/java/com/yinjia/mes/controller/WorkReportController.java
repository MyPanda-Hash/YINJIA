package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.ButtonService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 工序报工(移动端扫码报工,2026-10-21 新增)。
 *
 * <p>用户口径:「再写一个工序报工的面版,扫码然后填工序,工序有成型/切碳/组装3个工序。
 * 然后选择后填入数量。提交后根据这个工序报工会影响到生产工单里面的工序进度和当前工序,
 * 还会填入报工记录。」
 *
 * <p><b>为什么不自己重算工序进度</b>:项目已有唯一的推进链路 ——
 * 报工单 {@code WO_REPORT} 保存 → <b>审核</b>触发 {@code ButtonService.runWoAuditHooks},
 * 它依次做:报工记账(wgzt='Y')、工序任务回写、<b>转序派线</b>({@code ProcessTaskService.applyNextProcess})、
 * 生成检验单草稿、入库回填。工序进度/当前工序就在这条链里算,自己再算一遍必然和看板分叉
 * (2026-10-16 就出现过「有报工但工序进度不变蓝」的分叉事故)。
 * ⇒ 这里只做两件事:① 备齐一条报工需要的上下文(工单行 + 工序台账 + 今日已报);
 * ② 提交时走**同一条** {@code callButton} 路径(保存→审核),不另写 SQL 记账。
 *
 * <p>工序名口径:库里实际用的是「成型 / 切炭 / 组装」(注意是**切炭**,用户口述写成"切碳");
 * 台账表 {@code wo_process_line.工序} 与工序字典同源,本接口按台账下发,前端不再硬编。
 */
@RestController
@RequestMapping("/api/px/workReport")
public class WorkReportController {

    private final JdbcTemplate jdbc;
    private final ButtonService buttons;

    public WorkReportController(JdbcTemplate jdbc, ButtonService buttons) {
        this.jdbc = jdbc;
        this.buttons = buttons;
    }

    /**
     * 报工上下文:扫工单码之后页面需要的全部数据。
     *
     * @param woNo 工单号
     * @param line 工单行号(0/空 = 未指定,取已排产的第一行)
     */
    @GetMapping("/context")
    public ApiResult<Map<String, Object>> context(@RequestParam String woNo,
                                                  @RequestParam(required = false) Integer line) {
        String no = woNo == null ? "" : woNo.trim();
        if (no.isEmpty()) throw new IllegalArgumentException("工单号不能为空");

        // 工单行:与生产领料同一口径(plang + 排产量),行号优先
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT p.id, p.pl_no AS 工单号, p.pl_xc AS 工单行号, ISNULL(p.scx,N'') AS 生产线,"
                        + " ISNULL(p.dm,N'') AS 物料编码, ISNULL(p.mc,N'') AS 产品名称,"
                        + " ISNULL(p.gg,N'') AS 规格型号, ISNULL(p.jldw,N'') AS 计量单位,"
                        + " ISNULL(p.pl_sl,0) AS 排产数量, ISNULL(p.lot_no,N'') AS 批号,"
                        + " ISNULL(p.[当前工序],N'') AS 当前工序, ISNULL(p.[完工状态],N'') AS 完工状态"
                        + " FROM dbo.plang p WHERE p.pl_no=? AND ISNULL(p.asp_cancel,'N')<>'Y'"
                        + " ORDER BY p.pl_xc", no);
        if (rows.isEmpty()) throw new IllegalArgumentException("没有找到该工单(已作废的单查不到)");

        Map<String, Object> head = rows.get(0);
        Integer want = line;
        if (want != null && want > 0) {
            for (Map<String, Object> r : rows) {
                Object xc = r.get("工单行号");
                if (xc != null && ((Number) xc).intValue() == want.intValue()) { head = r; break; }
            }
        }
        Long rowId = ((Number) head.get("id")).longValue();

        // 工序台账(wo_process_line):工序序 / 计划数量 / 状态 / 计划生产线
        String batch = String.valueOf(head.getOrDefault("批号", "") == null ? "" : head.get("批号")).trim();
        List<Map<String, Object>> ledger = new ArrayList<>();
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT ISNULL(工序,N'') AS 工序, ISNULL(工序序,0) AS 工序序,"
                        + " ISNULL(计划数量,0) AS 计划数量, ISNULL(状态,N'') AS 状态,"
                        + " ISNULL(计划生产线,N'') AS 计划生产线, ISNULL(实际生产线,N'') AS 实际生产线"
                        + " FROM dbo.wo_process_line WHERE 工单行id=? AND ISNULL(asp_cancel,'N')<>'Y'"
                        + " ORDER BY ISNULL(工序序,999)", rowId)) {
            Map<String, Object> m = new LinkedHashMap<>(r);
            String op = String.valueOf(m.getOrDefault("工序", "")).trim();
            // 口径与 ProcessTaskService.syncOneRowState / WorkOrderListController 完全一致:
            //   行锚 = scjl.gd_id → plang_pc.plang_id;**草稿期 gd_id 还是 0**(审核时才写),
            //   所以必须带「批次号」兜底,否则刚报上去的单在页面上看不到(2026-10-21 实测踩到)。
            // 已报工 = 已审核(wgzt='Y');待审核 = 其余(审核后才会变已报工并推进工序进度)。
            Double done = jdbc.queryForObject(
                    "SELECT ISNULL(SUM(ISNULL(sl,0)),0) FROM dbo.scjl"
                            + " WHERE gldh=? AND gxdm=? AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(wgzt,'N')='Y'"
                            + "   AND (EXISTS (SELECT 1 FROM dbo.plang_pc pc WHERE pc.id=scjl.gd_id AND pc.plang_id=?)"
                            + "        OR (ISNULL(gd_id,0)=0 AND ISNULL([批次号],N'')=ISNULL(?,N'')))",
                    Double.class, no, op, rowId, batch);
            Double pending = jdbc.queryForObject(
                    "SELECT ISNULL(SUM(ISNULL(sl,0)),0) FROM dbo.scjl"
                            + " WHERE gldh=? AND gxdm=? AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(wgzt,'N')<>'Y'"
                            + "   AND (EXISTS (SELECT 1 FROM dbo.plang_pc pc WHERE pc.id=scjl.gd_id AND pc.plang_id=?)"
                            + "        OR (ISNULL(gd_id,0)=0 AND ISNULL([批次号],N'')=ISNULL(?,N'')))",
                    Double.class, no, op, rowId, batch);
            m.put("已报工", done == null ? 0 : done);
            m.put("待审核", pending == null ? 0 : pending);
            ledger.add(m);
        }

        // 今日该工单行的报工明细(报工记录)
        List<Map<String, Object>> today = jdbc.queryForList(
                "SELECT s.id, ISNULL(s.[报工单号],N'') AS 报工单号, ISNULL(s.gxdm,N'') AS 工序,"
                        + " ISNULL(s.sl,0) AS 报工数量, ISNULL(s.ywman,N'') AS 报工人,"
                        + " ISNULL(s.wgzt,N'N') AS 完工状态, CONVERT(varchar(19), s.sc_date, 120) AS 单据日期"
                        + " FROM dbo.scjl s WHERE s.gldh=? AND ISNULL(s.asp_cancel,'N')<>'Y'"
                        + "   AND s.sc_date >= ? AND s.sc_date < ?"
                        + "   AND (EXISTS (SELECT 1 FROM dbo.plang_pc pc WHERE pc.id=s.gd_id AND pc.plang_id=?)"
                        + "        OR ISNULL(s.gd_id,0)=0)"
                        + " ORDER BY s.id DESC", no, LocalDate.now(), LocalDate.now().plusDays(1), rowId);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("工单", head);
        out.put("工序台账", ledger);
        out.put("今日报工", today);
        out.put("可报工行", rows);      // 同工单其它行(扫错行时可切换)
        return ApiResult.ok(out);
    }

    /**
     * 提交报工:建 {@code WO_REPORT} 报工单并**立即审核** —— 只有审核才会触发
     * 工序进度 / 当前工序 / 转序派线的钩子(见类注释)。
     *
     * @param body { woNo, lineId(可空), 工序, 数量, 报工人, 批次号(可空), 生产线(可空) }
     */
    @PostMapping("/submit")
    @org.springframework.transaction.annotation.Transactional
    public ApiResult<Map<String, Object>> submit(@RequestBody Map<String, Object> body) {
        String woNo = str(body.get("woNo"));
        String op = str(body.get("工序"));
        String user = str(body.get("报工人"));
        double qty = num(body.get("数量"));
        if (woNo.isEmpty()) throw new IllegalArgumentException("工单号不能为空");
        if (op.isEmpty()) throw new IllegalArgumentException("请先选择工序");
        if (qty <= 0) throw new IllegalArgumentException("报工数量必须大于 0");

        Map<String, Object> line = new LinkedHashMap<>();
        line.put("工单号", woNo);
        line.put("工序", op);
        line.put("报工数量", qty);
        if (!user.isEmpty()) line.put("报工人", user);
        if (!str(body.get("批次号")).isEmpty()) line.put("批次号", str(body.get("批次号")));
        if (!str(body.get("生产线")).isEmpty()) line.put("生产线", str(body.get("生产线")));
        Object lineNo = body.get("工单行号");
        if (lineNo != null && !String.valueOf(lineNo).isBlank()) line.put("工单行号", lineNo);

        Map<String, Object> head = new LinkedHashMap<>();
        head.put("单据日期", LocalDate.now().toString());
        head.put("单据编号", "");                 // 由 FormNoService 生成(BG 前缀)
        head.put("detail", Map.of("items", List.of(line)));

        // ① 保存(草稿 → 正式保存),与手工建单同一条路径
        Map<String, Object> saved = buttons.callButton("WO_REPORT", "保存", head, Map.of());
        // ⚠ ButtonService.result() 的返回键是 **编号**(不是 单据编号/单号)——
        //   2026-10-21 现场报错「报工单保存后没有取到单据编号」就是这里读错键。
        //   三个都试一遍,兼容 result() 未来改名。
        String no = firstNonEmpty(saved.get("编号"), saved.get("单据编号"), saved.get("单号"));
        if (no.isEmpty()) throw new IllegalStateException("报工单保存后没有取到单据编号:" + saved);

        // ② 生效:工序进度/当前工序只在**审核**那一步推进(钩子 ButtonService.runWoAuditHooks)。
        //   · 管理员:直接「审核」⇒ 当场生效;
        //   · 其他角色:直审是收权的(ButtonService.audit 只给管理员) ⇒ 走「提交审批」,
        //     由有审批权的角色「审批通过」后才生效。
        //   ⚠ 2026-10-21 实测教训:这里**不能吞异常** —— 首版用 try/catch 兜住"提交审批"失败,
        //     结果单据建出来了(pending=N 的孤儿单),页面却只报一句泛泛的错,状态卡在草稿。
        //     现在失败时把「单号 + 原因」一起抛给前端,页面提示去「工序报工单」里审核那张单。
        Map<String, Object> auditBody = new LinkedHashMap<>();
        auditBody.put("编号", no);
        boolean admin = isAdmin();
        Map<String, Object> effect;
        String mode;
        try {
            effect = buttons.callButton("WO_REPORT", admin ? "审核" : "提交审批", auditBody, Map.of());
            mode = admin ? "已审核" : "待审核";
        } catch (Exception e) {
            // callButton 是 @Transactional ⇒ 同一事务里抛异常会把"保存"一起回滚,
            // 所以这里可以放心说"没有保存",不会留下孤儿草稿单。
            throw new IllegalStateException("报工没有提交成功:"
                    + (admin ? "审核" : "提交审批") + "失败(" + e.getMessage() + ")。请稍后重试,"
                    + "或直接到「工序报工单」手工建单。");
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("报工单号", no);
        out.put("生效方式", mode);          // 已审核 = 当场影响工序进度;待审核 = 等审批
        out.put("审核结果", effect);
        out.put("工序", op);
        out.put("数量", qty);
        return ApiResult.ok(out);
    }

    /**
     * 当前登录人是否管理员 —— 与 ButtonService.isAdminUser 同口径(yj_user.is_admin='Y'),
     * 不要用 Spring 的 authority 猜:实测 admin 的 authority 里并没有 ADMIN 字样。
     */
    private boolean isAdmin() {
        try {
            var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || auth.getName() == null) return false;
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT is_admin FROM yj_user WHERE username=?", auth.getName());
            return !rows.isEmpty() && "Y".equals(String.valueOf(rows.get(0).get("is_admin")));
        } catch (Exception e) {
            return false;
        }
    }

    private static String str(Object v) { return v == null ? "" : String.valueOf(v).trim(); }

    /** 取第一个非空值(ButtonService 的返回键历史上换过名字,别吊死在一个键上) */
    private static String firstNonEmpty(Object... vals) {
        for (Object v : vals) {
            String s = str(v);
            if (!s.isEmpty() && !"null".equalsIgnoreCase(s)) return s;
        }
        return "";
    }

    private static double num(Object v) {
        if (v == null) return 0;
        try { return Double.parseDouble(String.valueOf(v).trim()); } catch (Exception e) { return 0; }
    }
}
