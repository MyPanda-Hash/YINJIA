package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.PagePanelRegistry;
import com.yinjia.mes.service.PanelPermissionService;
import com.yinjia.mes.service.ProcCardService;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 工序流程追踪卡(生产计划 →「工序流程追踪卡」,2026-10-29)。
 *
 * <p>方案基线:docs/design/工序流程追踪卡-V1.0.md(§3 接口契约、§4 权限)。
 * 本类只做**参数校验 + 转发**,SQL 与业务规则全部在 {@link ProcCardService}(代码规范 A2)。
 *
 * <p><b>权限</b>:全部接口先 {@code requirePanelView(PROC_FLOW_CARD)}(页面级虚拟面板,登记在
 * {@link PagePanelRegistry},授权落 yj_role_panel);写端点再按动作词校验:
 * <ul>
 *   <li>创建流程卡 / 保存(备注等录入动作)→ {@code entry};</li>
 *   <li>卡状态改「已完成」或撤回「录入中」→ {@code confirm}(状态变更才是确认动作);</li>
 *   <li>照片上传/删除/下载走既有 {@code /api/attachment/*},不在本控制器;</li>
 *   <li>按钮名与页面文案一致;按钮→动作词映射见 {@link PanelPermissionService}(已登记)。</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/procCard")
public class ProcCardController {

    /** 本页唯一的权限面板(requireButtonAny 参数形态,便于将来并入其它入口) */
    private static final String[] PANEL = {PagePanelRegistry.PROC_FLOW_CARD};

    private final ProcCardService service;
    private final PanelPermissionService perm;

    public ProcCardController(ProcCardService service, PanelPermissionService perm) {
        this.service = service;
        this.perm = perm;
    }

    /** 下拉选项:{ 工序:[…], 卡状态:[录入中, 已完成] } */
    @PostMapping("/meta")
    public ApiResult<Map<String, Object>> meta() {
        perm.requirePanelView(PagePanelRegistry.PROC_FLOW_CARD);
        return ApiResult.ok(service.meta());
    }

    /** 大批次列表(录入页签下拉):{关键字, 日期从, 日期到} 均可空 */
    @PostMapping("/batches")
    public ApiResult<List<Map<String, Object>>> batches(@RequestBody(required = false) Map<String, Object> body) {
        perm.requirePanelView(PagePanelRegistry.PROC_FLOW_CARD);
        Map<String, Object> b = body == null ? Map.of() : body;
        return ApiResult.ok(service.batches(str(b.get("关键字")), str(b.get("日期从")), str(b.get("日期到"))));
    }

    /** 某大批次下的工单行(小批次候选,含已建卡信息):{批次号, 关键字} */
    @PostMapping("/lines")
    public ApiResult<List<Map<String, Object>>> lines(@RequestBody(required = false) Map<String, Object> body) {
        perm.requirePanelView(PagePanelRegistry.PROC_FLOW_CARD);
        Map<String, Object> b = body == null ? Map.of() : body;
        return ApiResult.ok(service.lines(str(b.get("批次号")), str(b.get("关键字"))));
    }

    /**
     * 为某工单行建卡(**幂等**:该行已有卡则直接返回既有卡,含 data 结构与 /detail 相同)。
     * 动作词 entry(「创建流程卡」)。
     */
    @PostMapping("/create")
    public ApiResult<Map<String, Object>> create(@RequestBody(required = false) Map<String, Object> body) {
        perm.requirePanelView(PagePanelRegistry.PROC_FLOW_CARD);
        perm.requireButtonAny(PANEL, "创建流程卡");
        Map<String, Object> b = body == null ? Map.of() : body;
        Long rowId = longOf(b.get("工单行id"));
        if (rowId == null) throw new IllegalArgumentException("请提供工单行id");
        return ApiResult.ok(service.create(rowId, str(b.get("备注")), currentUser()));
    }

    /** 卡详情(完成情况现算):{卡号} 或 {工单行id} */
    @PostMapping("/detail")
    public ApiResult<Map<String, Object>> detail(@RequestBody(required = false) Map<String, Object> body) {
        perm.requirePanelView(PagePanelRegistry.PROC_FLOW_CARD);
        Map<String, Object> b = body == null ? Map.of() : body;
        return ApiResult.ok(service.detail(str(b.get("卡号")), longOf(b.get("工单行id"))));
    }

    /**
     * 保存卡:允许改 备注 / 卡状态。
     *
     * <p>「保存」动作词 = entry(录入动作);一旦要改卡状态(置已完成 / 撤回录入中),那是**确认**动作
     * ⇒ 再加 confirm 词。置「已完成」的服务端强校验(全部工序已完工 + 每道至少一张照片)在 service 里,
     * 不满足抛 IllegalArgumentException(HTTP 400)。
     */
    @PostMapping("/save")
    public ApiResult<Map<String, Object>> save(@RequestBody(required = false) Map<String, Object> body) {
        perm.requirePanelView(PagePanelRegistry.PROC_FLOW_CARD);
        perm.requireButtonAny(PANEL, "保存");
        Map<String, Object> b = body == null ? Map.of() : body;
        String status = str(b.get("卡状态"));
        if (status != null) perm.requireButtonAny(PANEL, "确认完成");
        // 备注:传了键才改("" = 清空),没传键 = 保持原值 —— 只翻卡状态时不能顺手把备注抹了
        String remark = b.containsKey("备注") ? str(b.get("备注")) : null;
        return ApiResult.ok(service.save(str(b.get("卡号")), remark, status, currentUser()));
    }

    /** 卡片列表(按产品物料查,分页):{总行数, 行} */
    @PostMapping("/list")
    public ApiResult<Map<String, Object>> list(@RequestBody(required = false) Map<String, Object> body) {
        perm.requirePanelView(PagePanelRegistry.PROC_FLOW_CARD);
        Map<String, Object> b = body == null ? Map.of() : body;
        return ApiResult.ok(service.list(str(b.get("产品编码")), str(b.get("产品名称")), str(b.get("规格型号")),
                str(b.get("工单号")), str(b.get("批次号")), str(b.get("卡状态")), str(b.get("日期从")),
                str(b.get("日期到")), intOf(b.get("pageNo")), intOf(b.get("pageSize"))));
    }

    /** 批次追溯:{批次号, 汇总, 卡片} */
    @PostMapping("/batchTrace")
    public ApiResult<Map<String, Object>> batchTrace(@RequestBody(required = false) Map<String, Object> body) {
        perm.requirePanelView(PagePanelRegistry.PROC_FLOW_CARD);
        Map<String, Object> b = body == null ? Map.of() : body;
        return ApiResult.ok(service.batchTrace(str(b.get("批次号"))));
    }

    /** 单卡追溯:{卡, 工序进度, 报工记录, 照片, 工单追溯(复用 ScheduleBoardService.trace)} */
    @PostMapping("/trace")
    public ApiResult<Map<String, Object>> trace(@RequestBody(required = false) Map<String, Object> body) {
        perm.requirePanelView(PagePanelRegistry.PROC_FLOW_CARD);
        Map<String, Object> b = body == null ? Map.of() : body;
        String cardNo = str(b.get("卡号"));
        if (cardNo == null) throw new IllegalArgumentException("请提供卡号");
        return ApiResult.ok(service.trace(cardNo));
    }

    private static String currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null || auth.getName() == null || auth.getName().isBlank() ? "system" : auth.getName();
    }

    private static String str(Object o) {
        if (o == null) return null;
        String s = String.valueOf(o).trim();
        return s.isBlank() || "null".equals(s) ? null : s;
    }

    private static Long longOf(Object o) {
        if (o instanceof Number n) return n.longValue();
        String s = str(o);
        if (s == null) return null;
        try {
            return Long.valueOf(s);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("工单行id 格式不正确:" + s);
        }
    }

    private static Integer intOf(Object o) {
        if (o instanceof Number n) return n.intValue();
        String s = str(o);
        if (s == null) return null;
        try {
            return Integer.valueOf(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
