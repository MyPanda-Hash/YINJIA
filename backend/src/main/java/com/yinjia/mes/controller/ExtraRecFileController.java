package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.ExtraRecFileService;
import com.yinjia.mes.service.PanelPermissionService;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

/**
 * 特殊数据记录表接口（/api/extra-rec-file）——「数据记录表」下的上传类面板。
 *
 * <p>用户口径 2026-11-17：上传特殊数据记录表、点开预览、删除需管理员审批、
 * **能看这个面板的人都能查看**上传的文件。追问确认：全员可传 / 删除走**单独的「待审批删除」列表**。</p>
 *
 * <p>权限（服务端强制，前端只管显隐）：</p>
 * <ul>
 *   <li>查看/下载 = 面板 view（query）；</li>
 *   <li>上传/提交删除申请 = add（迁移种子已授予全部角色 ⇒ 全员可传）；</li>
 *   <li>审批删除 = 管理员 或 (can_approve='Y' 且 del 词)，判定在 Service 里。</li>
 * </ul>
 *
 * <p>⚠ 文件本体不经本控制器：走既有 {@code /api/attachment/{id}/download}（按面板查看权把关，
 * 与用户口径「能看面板就能看文件」一致）。</p>
 */
@RestController
@RequestMapping("/api/extra-rec-file")
public class ExtraRecFileController {

    private final ExtraRecFileService service;
    private final PanelPermissionService perms;

    public ExtraRecFileController(ExtraRecFileService service, PanelPermissionService perms) {
        this.service = service;
        this.perms = perms;
    }

    /** 当前用户按钮门禁：canUpload / canApproveDelete / pendingCount。 */
    @GetMapping("/perm")
    public ApiResult<Map<String, Object>> perm(Authentication auth) {
        perms.requirePanelView(ExtraRecFileService.PANEL);
        return ApiResult.ok(service.permOfCurrentUser(currentUsername(auth)));
    }

    /**
     * 列表。
     *
     * @param pending true = 只看「待审批删除」（管理员那个列表）；默认 false = 正常文件
     */
    @GetMapping("/list")
    public ApiResult<Map<String, Object>> list(@RequestParam(required = false) String keyword,
                                               @RequestParam(defaultValue = "false") boolean pending,
                                               @RequestParam(defaultValue = "1") int pageNo,
                                               @RequestParam(defaultValue = "20") int pageSize,
                                               Authentication auth) {
        perms.requirePanelView(ExtraRecFileService.PANEL);
        // 「待审批删除」列表只给有审批权的人看 —— 普通用户没资格看别人的待删清单
        if (pending && !Boolean.TRUE.equals(service.permOfCurrentUser(currentUsername(auth)).get("canApproveDelete"))) {
            return ApiResult.fail(403, "没有查看待审批删除列表的权限");
        }
        return ApiResult.ok(service.list(keyword, pending, pageNo, pageSize));
    }

    /** 上传：multipart {file} + 元数据（名称/分类/关键词/备注）。全员可传。 */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResult<Map<String, Object>> upload(@RequestPart("file") MultipartFile file,
                                                 @RequestParam(required = false) String name,
                                                 @RequestParam(required = false) String category,
                                                 @RequestParam(required = false) String keywords,
                                                 @RequestParam(required = false) String remark,
                                                 Authentication auth) throws IOException {
        perms.requireAnyPerm(ExtraRecFileService.PANEL, "上传", "add", "modify");
        return ApiResult.ok(service.upload(name, category, keywords, remark, file, currentUsername(auth)));
    }

    /** 提交删除申请（人人可申请）。 */
    @PostMapping("/requestDelete")
    public ApiResult<Map<String, Object>> requestDelete(@RequestBody Map<String, Object> body, Authentication auth) {
        perms.requireAnyPerm(ExtraRecFileService.PANEL, "申请删除", "add", "modify");
        Object id = body.get("id");
        if (!(id instanceof Number n)) return ApiResult.fail(400, "id 无效");
        Object note = body.get("note");
        return ApiResult.ok(service.requestDelete(n.longValue(), note == null ? null : String.valueOf(note),
                currentUsername(auth)));
    }

    /** 撤回删除申请（申请人本人或管理员）。 */
    @PostMapping("/cancelDelete")
    public ApiResult<Map<String, Object>> cancelDelete(@RequestBody Map<String, Object> body, Authentication auth) {
        perms.requirePanelView(ExtraRecFileService.PANEL);
        Object id = body.get("id");
        if (!(id instanceof Number n)) return ApiResult.fail(400, "id 无效");
        return ApiResult.ok(service.cancelDelete(n.longValue(), currentUsername(auth)));
    }

    /** 审批删除：approve=true 通过（物理删除）/ false 驳回。 */
    @PostMapping("/decideDelete")
    public ApiResult<Map<String, Object>> decideDelete(@RequestBody Map<String, Object> body,
                                                       Authentication auth) throws IOException {
        perms.requirePanelView(ExtraRecFileService.PANEL);
        Object id = body.get("id");
        if (!(id instanceof Number n)) return ApiResult.fail(400, "id 无效");
        boolean approve = Boolean.TRUE.equals(body.get("approve"))
                || "true".equalsIgnoreCase(String.valueOf(body.get("approve")));
        return ApiResult.ok(service.decideDelete(n.longValue(), approve, currentUsername(auth)));
    }

    private static String currentUsername(Authentication authentication) {
        return authentication == null || authentication.getName() == null ? "" : authentication.getName();
    }
}

