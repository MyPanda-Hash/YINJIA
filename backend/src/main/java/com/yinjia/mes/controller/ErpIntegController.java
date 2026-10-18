package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.ErpIntegService;
import com.yinjia.mes.service.PagePanelRegistry;
import com.yinjia.mes.service.PanelPermissionService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * ERP 集成配置清单接口(2026-10-18)——「导入 / 转出」两向 × 分类 × 接口 / 设备 / 字段映射的统一配置面板。
 *
 * <p>权限锚点 = 页面级虚拟面板 {@link PagePanelRegistry#ERP_INTEG}(与订单结转等看板同一套机制,
 * 不插 yj_panel 行,授权落 yj_role_panel):
 * <ul>
 *   <li>读(配置/元数据/面板字段)= 该面板 {@code view} 词(组织架构里勾「可见」即可看);</li>
 *   <li>写(存接口 / 存字段映射 / 存设备绑定 / 删接口)= **仅管理员**
 *       (2026-10-18 用户口径「保证这个面板除管理员只可看不可编辑」)。</li>
 * </ul>
 *
 * <p>⚠ 写闸门**不挂权限词**,直接 {@code perm.requireAdmin()}:矩阵里该页面只有一个「可见」格子,
 * 非管理员无论如何都授不出写权限;`ERP_INTEG` 同时登记在
 * {@code PanelPermissionService.ADMIN_ONLY_PANELS} 做纵深防御。
 *
 * <p>⚠ 本控制器**只读写三张配置表**,不推送金蝶、不动业务表;真正的推送仍在
 * {@code ButtonService.转ERP → KingdeePushService}。
 */
@RestController
@RequestMapping("/api/erp/integ")
public class ErpIntegController {

    /** 页面级虚拟面板码(见 PagePanelRegistry.ERP_INTEG) */
    private static final String PAGE = PagePanelRegistry.ERP_INTEG;

    private final ErpIntegService service;
    private final PanelPermissionService perm;

    public ErpIntegController(ErpIntegService service, PanelPermissionService perm) {
        this.service = service;
        this.perm = perm;
    }

    /** 全量配置(接口 + 字段映射 + 设备绑定 + 统计) */
    @GetMapping("/config")
    public ApiResult<Map<String, Object>> config() {
        perm.requirePanelView(PAGE);
        return ApiResult.ok(service.config());
    }

    /** 元数据:设备档案(bs_equip 去重未停用)/ 面板清单 / 转换规则 / 分类词表 */
    @GetMapping("/meta")
    public ApiResult<Map<String, Object>> meta() {
        perm.requirePanelView(PAGE);
        return ApiResult.ok(service.meta());
    }

    /** 某面板的字段清单(MES 字段下拉的数据源) */
    @GetMapping("/panelFields")
    public ApiResult<List<Map<String, Object>>> panelFields(@RequestParam String panelCode) {
        perm.requirePanelView(PAGE);
        return ApiResult.ok(service.panelFields(panelCode));
    }

    @PostMapping("/item")
    public ApiResult<Void> saveItem(@RequestBody Map<String, Object> body) {
        perm.requireAdmin(); // 除管理员只可看不可编辑
        service.saveItem(body);
        return ApiResult.ok(null);
    }

    @PostMapping("/item/delete")
    public ApiResult<Void> deleteItem(@RequestBody Map<String, Object> body) {
        perm.requireAdmin();
        service.deleteItem(body.get("接口编码") == null ? "" : String.valueOf(body.get("接口编码")));
        return ApiResult.ok(null);
    }

    /** 保存某接口的字段映射(整表替换,顺序即提交顺序) */
    @PostMapping("/fields")
    @SuppressWarnings("unchecked")
    public ApiResult<Void> saveFields(@RequestBody Map<String, Object> body) {
        perm.requireAdmin();
        String code = body.get("接口编码") == null ? "" : String.valueOf(body.get("接口编码"));
        Object rows = body.getOrDefault("rows", List.of());
        service.saveFields(code, (List<Map<String, Object>>) rows);
        return ApiResult.ok(null);
    }

    /** 保存某接口的设备绑定(整表替换) */
    @PostMapping("/devices")
    @SuppressWarnings("unchecked")
    public ApiResult<Void> saveDevices(@RequestBody Map<String, Object> body) {
        perm.requireAdmin();
        String code = body.get("接口编码") == null ? "" : String.valueOf(body.get("接口编码"));
        Object rows = body.getOrDefault("rows", List.of());
        service.saveDevices(code, (List<Map<String, Object>>) rows);
        return ApiResult.ok(null);
    }
}
