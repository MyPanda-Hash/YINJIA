package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.PanelPermissionService;
import com.yinjia.mes.service.SupplierPortalService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 供应商门户接口(2026-10-24)。
 *
 * <pre>
 *  供应商端(只认"当前登录账号绑定的是哪个供应商",前端传的供应商编码一律不采信):
 *    GET  /portal/me                       → { supplierCode, supplierName, userName, realName, factory }
 *    GET  /portal/orders                   → 采购订单清单(分页/关键词/日期/只看未关闭)
 *    GET  /portal/order?docNo=…            → 单张订单(头 + 明细行;按 单据号+供应商编码 双过滤)
 *    POST /portal/print                    → 打印留痕(同样先核归属)
 *  管理员端(全部 requireAdmin):
 *    GET  /accounts                        → 供应商账号列表
 *    GET  /accounts/overview               → 顶部统计
 *    GET  /suppliers?keyword=              → 供应商档案下拉
 *    POST /accounts/save                   → 新建/修改(同事务写 yj_supplier_account + yj_user)
 *    DELETE /accounts/{id}                 → 删除
 * </pre>
 *
 * <p>鉴权三层同源:① {@code SupplierPortalGuardFilter} —— 供应商会话的 /api 请求只放行本控制器
 * (其余全部 403,这是"没有别的权限"的硬闸门);② 各方法内的 {@code requireSupplier()}/requireAdmin;
 * ③ SQL 里的 {@code 供应商编码 = ?}(数据隔离)。
 */
@RestController
@RequestMapping("/api/supplier/portal")
public class SupplierPortalController {

    private final SupplierPortalService portal;
    private final PanelPermissionService perm;

    public SupplierPortalController(SupplierPortalService portal, PanelPermissionService perm) {
        this.portal = portal;
        this.perm = perm;
    }

    // ============ 供应商端 ============

    /** 我是谁(供应商端首屏用来显示"供应商编码 + 名称") */
    @GetMapping("/me")
    public ApiResult<Map<String, Object>> me() {
        String code = portal.currentSupplierCode();
        if (code == null || code.isEmpty()) {
            throw new org.springframework.security.access.AccessDeniedException("当前账号不是供应商账号,无法使用供应商门户");
        }
        String user = SecurityContextHolder.getContext().getAuthentication() == null ? ""
                : SecurityContextHolder.getContext().getAuthentication().getName();
        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("supplierCode", code);
        out.put("supplierName", portal.supplierName(code));
        out.put("userName", user);
        out.put("realName", user);
        out.put("factory", com.yinjia.mes.config.DataSourceRouter.current());
        return ApiResult.ok(out);
    }

    /** 采购订单清单(只出本供应商的) */
    @GetMapping("/orders")
    public ApiResult<Map<String, Object>> orders(@RequestParam(required = false) String keyword,
                                                 @RequestParam(required = false) String start,
                                                 @RequestParam(required = false) String end,
                                                 @RequestParam(defaultValue = "false") boolean onlyOpen,
                                                 @RequestParam(defaultValue = "1") int pageNo,
                                                 @RequestParam(defaultValue = "20") int pageSize) {
        return ApiResult.ok(portal.orders(keyword, start, end, onlyOpen, pageNo, pageSize));
    }

    /** 单张订单(头 + 明细) */
    @GetMapping("/order")
    public ApiResult<Map<String, Object>> order(@RequestParam String docNo) {
        return ApiResult.ok(portal.orderDetail(docNo));
    }

    /** 打印留痕(谁、何时、打了哪张单) */
    @PostMapping("/print")
    public ApiResult<Void> print(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        String docNo = body == null || body.get("docNo") == null ? "" : String.valueOf(body.get("docNo")).trim();
        if (docNo.isEmpty()) throw new IllegalArgumentException("缺少单据编号");
        portal.recordPrint(docNo, clientIp(request));
        return ApiResult.ok(null);
    }

    // ============ 管理员端:供应商账号维护 ============

    @GetMapping("/accounts/overview")
    public ApiResult<Map<String, Object>> overview() {
        perm.requireAdmin();
        return ApiResult.ok(portal.overview());
    }

    @GetMapping("/accounts")
    public ApiResult<List<Map<String, Object>>> accounts(@RequestParam(required = false) String keyword,
                                                         @RequestParam(required = false) String supplierCode) {
        perm.requireAdmin();
        return ApiResult.ok(portal.accounts(keyword, supplierCode));
    }

    /** 供应商档案下拉(dm_gf);供应商权限配置页选供应商用 */
    @GetMapping("/suppliers")
    public ApiResult<List<Map<String, Object>>> suppliers(@RequestParam(required = false) String keyword) {
        perm.requireAdmin();
        return ApiResult.ok(portal.suppliers(keyword));
    }

    @PostMapping("/accounts/save")
    public ApiResult<Void> saveAccount(@RequestBody Map<String, Object> body) {
        perm.requireAdmin();
        portal.saveAccount(body == null ? Map.of() : body);
        return ApiResult.ok(null);
    }

    @DeleteMapping("/accounts/{id}")
    public ApiResult<Void> deleteAccount(@PathVariable int id) {
        perm.requireAdmin();
        portal.deleteAccount(id);
        return ApiResult.ok(null);
    }

    private static String clientIp(HttpServletRequest request) {
        String fwd = request.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) return fwd.split(",")[0].trim();
        return request.getRemoteAddr();
    }
}
