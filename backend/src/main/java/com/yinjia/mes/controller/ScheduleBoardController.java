package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.PanelPermissionService;
import com.yinjia.mes.service.ScheduleBoardService;
import com.yinjia.mes.service.ProcessTaskService;
import com.yinjia.mes.service.WorkOrderTransferService;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 排产工作台(实现总结 V1.0 §5):待排产池/统计/批量排入/撤销排产/今日已排产。
 * 权限:查询=MANU_ORDER 可见;排入与撤销=MANU_ORDER 编辑权(挂"保存"词表)。
 */
@RestController
@RequestMapping("/api/px/scheduleBoard")
public class ScheduleBoardController {

    private final ScheduleBoardService service;
    private final PanelPermissionService perm;
    private final WorkOrderTransferService transferService;
    /** 工序—产线预排(2026-10-05):排产即按路线预排全程计划线 */
    private final ProcessTaskService processTask;

    public ScheduleBoardController(ScheduleBoardService service, PanelPermissionService perm,
                                   WorkOrderTransferService transferService, ProcessTaskService processTask) {
        this.service = service;
        this.perm = perm;
        this.transferService = transferService;
        this.processTask = processTask;
    }

    /** 待排产池(已审核·未指派产线);9.29 批次③:车间账号看不到池(池内行无产线 ⇒ 无车间判据)
     *  2026-10-15:支持 `限定行id` —— 生产工单页勾 N 行进来时,池只显示**这 N 行**
     *  (行id = plang.id,物理行;按「工单号+工单行号」表达不了"任意多行"的组合)。 */
    @PostMapping("/pending")
    public ApiResult<List<Map<String, Object>>> pending(@RequestBody(required = false) Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        return ApiResult.ok(service.pending(str(body == null ? null : body.get("keyword")),
                str(body == null ? null : body.get("客户")), workshop(),
                idList(body == null ? null : body.get("限定行id"))));
    }

    /** 统计:待排产/今日排产/总未完成 + 产线下拉(带当日负荷/日产能) + 班组下拉;按登录账号车间收敛 */
    @PostMapping("/stats")
    public ApiResult<Map<String, Object>> stats() {
        perm.requirePanelView("MANU_ORDER");
        return ApiResult.ok(service.stats(workshop()));
    }

    /** 批量排入:逐张 scheduleOne(守卫/守恒/留痕);回执含产线当日负荷/超载提示 */
    @PostMapping("/assign")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, Object>> assign(@RequestBody Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        perm.requireButton("MANU_ORDER", "保存");
        List<Map<String, Object>> rows = (List<Map<String, Object>>) body.getOrDefault("rows", List.of());
        return ApiResult.ok(service.assign(rows, currentUser()));
    }

    /**
     * 工序路线排线弹窗数据(2026-10-07):该工单行要走的每道工序 + 换算后计划量 + 默认计划完工日 + 已有台账。
     * 排产前用它把整条工艺路线的线**一次选好**(人工选,不再是系统自动预排)。
     */
    @PostMapping("/routeSteps")
    public ApiResult<Map<String, Object>> routeSteps(@RequestBody Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        String no = str(body.get("加工单号"));
        Object id = body.get("行id");
        Long lineId = id == null || String.valueOf(id).isBlank() ? null : Long.valueOf(String.valueOf(id));
        return ApiResult.ok(processTask.routeSteps(no, lineId));
    }

    /**
     * 工序路线排线提交(2026-10-07):**排产 + 预排全程线** —— 首道线写 plang.scx / plang_pc(复用现有排产口径),
     * 全路线写台账 wo_process_line;前道报工完工后自动转序到下一道的计划线。
     * 撤销排产会**同时作废台账**(避免"没排产却有计划线")。
     */
    @PostMapping("/preplan")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, Object>> preplan(@RequestBody Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        perm.requireButton("MANU_ORDER", "保存");
        String no = str(body.get("加工单号"));
        Object id = body.get("行id");
        Long lineId = id == null || String.valueOf(id).isBlank() ? null : Long.valueOf(String.valueOf(id));
        List<Map<String, Object>> steps = (List<Map<String, Object>>) body.getOrDefault("步骤", List.of());
        return ApiResult.ok(processTask.preplanManual(no, lineId, steps, str(body.get("排产班组")), currentUser()));
    }

    /** 撤销排产回池(换线=撤销+重排);有报工/入库不可撤销 */
    @PostMapping("/unassign")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, Object>> unassign(@RequestBody Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        perm.requireButton("MANU_ORDER", "保存");
        List<Map<String, Object>> rows = (List<Map<String, Object>>) body.getOrDefault("rows", List.of());
        return ApiResult.ok(service.unassign(rows, currentUser()));
    }

    /** 左侧骨架:生产线档案全部线(含停用)未交量汇总(参考工单排产页,2026-09-23 去班别;
     *  开线状态字段已随开线管理下线移除,2026-09-24 用户拍板);9.29 批次③:车间账号只出本车间的线 */
    @PostMapping("/linesSummary")
    public ApiResult<List<Map<String, Object>>> linesSummary(@RequestBody(required = false) Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        return ApiResult.ok(service.linesSummary(str(body == null ? null : body.get("开工日期")), workshop()));
    }

    /** 选中线 的排产明细(scope=未完工/已完工/全部);9.29 批次③:车间账号只认本车间的产线 */
    @PostMapping("/scheduled")
    public ApiResult<List<Map<String, Object>>> scheduled(@RequestBody(required = false) Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        return ApiResult.ok(service.scheduled(str(body == null ? null : body.get("生产线")),
                str(body == null ? null : body.get("scope")), workshop()));
    }

    /** 批量调线:勾选已排工单 → 目标生产线(停用线拒绝) */
    @PostMapping("/reassign")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, Object>> reassign(@RequestBody Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        perm.requireButton("MANU_ORDER", "保存");
        List<Map<String, Object>> rows = (List<Map<String, Object>>) body.getOrDefault("rows", List.of());
        return ApiResult.ok(service.reassign(rows, str(body.get("目标生产线")), currentUser()));
    }

    // ══════════ 工单调拨(9.29 生产管理批次 ②,2026-10-05):产线/车间两级目标 + 轨迹 + 可撤回 ══════════
    // 与 /reassign(只改产线、无轨迹)的区别:本组写 wo_transfer_log 轨迹并支持按轨迹撤回。
    // 权限:面板查看 + MANU_ORDER「保存」词表。

    /** 车间下拉(启用产线的车间 + 该车间产线数;调拨弹窗用) */
    @PostMapping("/workshops")
    public ApiResult<List<Map<String, Object>>> workshops() {
        perm.requirePanelView("MANU_ORDER");
        return ApiResult.ok(transferService.workshops());
    }

    /** 调拨:勾选工单 → 目标产线(+ 可选目标车间校验)+ 原因;写轨迹、留痕 */
    @PostMapping("/transfer")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, Object>> transfer(@RequestBody Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        perm.requireButton("MANU_ORDER", "保存");
        List<Map<String, Object>> rows = (List<Map<String, Object>>) body.getOrDefault("rows", List.of());
        return ApiResult.ok(transferService.transfer(rows, str(body.get("目标生产线")), str(body.get("目标车间")),
                str(body.get("原因")), currentUser()));
    }

    /** 撤回调拨:按工单最后一条生效轨迹把产线调回原线(轨迹标撤销,留痕不删) */
    @PostMapping("/transferRevoke")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, Object>> transferRevoke(@RequestBody Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        perm.requireButton("MANU_ORDER", "保存");
        List<Map<String, Object>> rows = (List<Map<String, Object>>) body.getOrDefault("rows", List.of());
        return ApiResult.ok(transferService.revoke(rows, currentUser()));
    }

    /** 今日已排产(mode=today)/全部已排产(mode=all);9.29 批次③:按登录账号车间收敛 */
    @PostMapping("/today")
    public ApiResult<List<Map<String, Object>>> today(@RequestBody(required = false) Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        return ApiResult.ok(service.today(str(body == null ? null : body.get("mode")),
                str(body == null ? null : body.get("keyword")), workshop()));
    }

    /** 工单追溯:头+时间线+排产/完工/入库+**质检段(三类工序检验单 + 应检/已检/缺检/结论汇总)**+领料+父子/调拨/家族 */
    @PostMapping("/trace")
    public ApiResult<Map<String, Object>> trace(@RequestBody Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        return ApiResult.ok(service.trace(str(body.get("工单号")), longOf(body.get("工单行id") != null ? body.get("工单行id") : body.get("行id"))));
    }

    private static Long longOf(Object o) {
        if (o == null || String.valueOf(o).isBlank() || "null".equals(String.valueOf(o))) return null;
        if (o instanceof Number n) return n.longValue();
        try { return Long.valueOf(String.valueOf(o).trim()); } catch (NumberFormatException e) { return null; }
    }

    /** 打印生产任务单留痕:打印次数+1、打印人/打印时间(权限=MANU_ORDER 打印) */
    @PostMapping("/printStamp")
    @SuppressWarnings("unchecked")
    public ApiResult<Map<String, Object>> printStamp(@RequestBody Map<String, Object> body) {
        perm.requirePanelView("MANU_ORDER");
        perm.requireButton("MANU_ORDER", "打印");
        List<Map<String, Object>> rows = (List<Map<String, Object>>) body.getOrDefault("rows", List.of());
        return ApiResult.ok(service.printStamp(rows, currentUser()));
    }

    private static String currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? "system" : auth.getName();
    }

    /**
     * 登录账号的生产车间(9.29 批次③「排产界面按车间过滤」):yj_user.生产车间;空 = 不受限
     * (管理员/计划组照旧看到全部产线与待排产池)。
     */
    private String workshop() {
        return service.workshopOf(currentUser());
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    /**
     * 请求体里的 id 数组 → List&lt;Long&gt;(容错:Number / 数字串 / 空值都收)。
     * 用于「限定行id」这类**任意多行**的精确圈定(2026-10-15)。
     */
    @SuppressWarnings("unchecked")
    private static List<Long> idList(Object o) {
        List<Long> out = new java.util.ArrayList<>();
        if (!(o instanceof List<?> l)) return out;
        for (Object x : (List<Object>) l) {
            if (x == null) continue;
            if (x instanceof Number n) { out.add(n.longValue()); continue; }
            String s = String.valueOf(x).trim();
            if (s.isEmpty() || "null".equals(s)) continue;
            try { out.add(Long.valueOf(s)); } catch (NumberFormatException ignore) { /* 跳过非数字 */ }
        }
        return out;
    }
}
