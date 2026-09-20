package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.PanelPermissionService;
import com.yinjia.mes.service.ShareFileService;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

/**
 * 共享文件库接口(/api/share-file,研发管理·全公司共享资料):
 * 分类树增删改 + 文件分页/上传/改元数据/换文件/删除。
 * 上传/修改/删除 = 面板 RD_SHARE_FILE 的 add|edit(|delete) 权限词(管理员恒过,服务端强制),
 * 查阅 = view(迁移种子已默认授予全部角色);不走审批流。文件本体经 AttachmentService 落 yj_attachment。
 */
@RestController
@RequestMapping("/api/share-file")
public class ShareFileController {

    private final ShareFileService service;
    private final PanelPermissionService perms;

    public ShareFileController(ShareFileService service, PanelPermissionService perms) {
        this.service = service;
        this.perms = perms;
    }

    /** 当前用户按钮门禁(上传/维护分类/删除)。 */
    @GetMapping("/perm")
    public ApiResult<Map<String, Object>> perm() {
        return ApiResult.ok(service.permOfCurrentUser());
    }

    // ══════════ 分类 ══════════

    @GetMapping("/categories")
    public ApiResult<List<Map<String, Object>>> categories() {
        perms.requireAnyPerm(ShareFileService.PANEL, "可见", "view");
        return ApiResult.ok(service.categories());
    }

    @PostMapping("/categories")
    public ApiResult<Void> addCategory(@RequestBody Map<String, Object> body, Authentication auth) {
        perms.requireAnyPerm(ShareFileService.PANEL, "新增", "add", "edit");
        service.addCategory(intOrNull(body.get("parentId")), str(body.get("name")),
                intOrNull(body.get("seq")), currentUsername(auth));
        return ApiResult.ok(null);
    }

    @PostMapping("/categories/{id}/update")
    public ApiResult<Void> updateCategory(@PathVariable int id, @RequestBody Map<String, Object> body, Authentication auth) {
        perms.requireAnyPerm(ShareFileService.PANEL, "修改", "add", "edit");
        service.updateCategory(id, intOrNull(body.get("parentId")), str(body.get("name")),
                intOrNull(body.get("seq")), currentUsername(auth));
        return ApiResult.ok(null);
    }

    @DeleteMapping("/categories/{id}")
    public ApiResult<Void> deleteCategory(@PathVariable int id) {
        perms.requireAnyPerm(ShareFileService.PANEL, "删除", "add", "edit");
        service.deleteCategory(id);
        return ApiResult.ok(null);
    }

    // ══════════ 文件 ══════════

    @GetMapping("/list")
    public ApiResult<Map<String, Object>> list(@RequestParam(required = false) Integer catId,
                                               @RequestParam(required = false) String keyword,
                                               @RequestParam(defaultValue = "1") int pageNo,
                                               @RequestParam(defaultValue = "20") int pageSize) {
        perms.requireAnyPerm(ShareFileService.PANEL, "可见", "view");
        return ApiResult.ok(service.list(catId, keyword, pageNo, pageSize));
    }

    /** 上传:multipart {file} + 表单元数据(分类/名称/版本/生效/失效/关键词/备注)。 */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResult<Map<String, Object>> upload(@RequestPart("file") MultipartFile file,
                                                 @RequestParam("catId") int catId,
                                                 @RequestParam(required = false) String name,
                                                 @RequestParam(required = false) String version,
                                                 @RequestParam(required = false) String effectiveDate,
                                                 @RequestParam(required = false) String expiryDate,
                                                 @RequestParam(required = false) String keywords,
                                                 @RequestParam(required = false) String remark,
                                                 Authentication auth) throws IOException {
        perms.requireAnyPerm(ShareFileService.PANEL, "新增", "add", "edit");
        return ApiResult.ok(service.upload(catId, name, version, effectiveDate, expiryDate,
                keywords, remark, file, currentUsername(auth)));
    }

    /** 改元数据(JSON,不动文件)。 */
    @PostMapping("/{id}/update")
    public ApiResult<Map<String, Object>> update(@PathVariable long id, @RequestBody Map<String, Object> body,
                                                 Authentication auth) {
        perms.requireAnyPerm(ShareFileService.PANEL, "修改", "add", "edit");
        return ApiResult.ok(service.update(id, intOrNull(body.get("catId")), str(body.get("name")),
                str(body.get("version")), str(body.get("effectiveDate")), str(body.get("expiryDate")),
                str(body.get("keywords")), str(body.get("remark")), currentUsername(auth)));
    }

    /** 换文件本体(multipart {file})。 */
    @PostMapping(value = "/{id}/replace-file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResult<Map<String, Object>> replaceFile(@PathVariable long id,
                                                      @RequestPart("file") MultipartFile file,
                                                      Authentication auth) throws IOException {
        perms.requireAnyPerm(ShareFileService.PANEL, "修改", "add", "edit");
        return ApiResult.ok(service.replaceFile(id, file, currentUsername(auth)));
    }

    @DeleteMapping("/{id}")
    public ApiResult<Void> delete(@PathVariable long id, Authentication auth) throws IOException {
        perms.requireAnyPerm(ShareFileService.PANEL, "删除", "add", "edit", "delete");
        service.delete(id, currentUsername(auth));
        return ApiResult.ok(null);
    }

    private static String currentUsername(Authentication authentication) {
        return authentication == null ? "" : authentication.getName();
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private static Integer intOrNull(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.intValue();
        try {
            String s = String.valueOf(o).trim();
            return s.isEmpty() ? null : Integer.valueOf(s);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("数值参数无效:" + o);
        }
    }
}
