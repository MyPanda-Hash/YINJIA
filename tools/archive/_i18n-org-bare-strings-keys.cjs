/**
 * _i18n-org-bare-strings-keys.cjs — 补 OrgAdmin.vue 那批「裸中文 → tt()」所需的 18 个词条
 *
 * 覆盖 10 个语言包(zh-CN 是源语言不建行);幂等:已存在的键跳过。
 * (机翻通道 /api/locale/dict 当前返回空 —— 本机后端未配阿里云 AK,故这里手写译文,
 *  不依赖机翻兜底。)
 * 用法:node tools/archive/_i18n-org-bare-strings-keys.cjs
 */
const fs = require('node:fs')
const path = require('node:path')

const DIR = path.join(__dirname, '..', '..', 'frontend', 'src', 'i18n', 'locales')
const L = ['zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'vi', 'th']

// 每行:中文键 + 按 L 顺序的 10 个译文
const ROWS = [
  ['批量分配失败', '批次分配角色失敗', 'Bulk role assignment failed', '一括ロール割り当てに失敗しました', '일괄 역할 할당 실패', 'Error al asignar rol en lote', "Échec de l'attribution groupée des rôles", 'Massenzuweisung der Rolle fehlgeschlagen', 'Не удалось назначить роль группе', 'Gán vai trò hàng loạt thất bại', 'กำหนดบทบาทแบบกลุ่มไม่สำเร็จ'],
  ['复制权限失败', '複製權限失敗', 'Copying permissions failed', '権限のコピーに失敗しました', '권한 복사 실패', 'Error al copiar permisos', 'Échec de la copie des permissions', 'Kopieren der Berechtigungen fehlgeschlagen', 'Не удалось скопировать права', 'Sao chép quyền thất bại', 'คัดลอกสิทธิ์ไม่สำเร็จ'],
  ['部门加载失败', '部門載入失敗', 'Failed to load departments', '部門の読み込みに失敗しました', '부서 로드 실패', 'Error al cargar departamentos', 'Échec du chargement des départements', 'Abteilungen konnten nicht geladen werden', 'Не удалось загрузить подразделения', 'Tải phòng ban thất bại', 'โหลดแผนกไม่สำเร็จ'],
  ['用户列表加载失败', '使用者清單載入失敗', 'Failed to load user list', 'ユーザー一覧の読み込みに失敗しました', '사용자 목록 로드 실패', 'Error al cargar la lista de usuarios', 'Échec du chargement de la liste des utilisateurs', 'Benutzerliste konnte nicht geladen werden', 'Не удалось загрузить список пользователей', 'Tải danh sách người dùng thất bại', 'โหลดรายชื่อผู้ใช้ไม่สำเร็จ'],
  ['角色列表加载失败', '角色清單載入失敗', 'Failed to load role list', 'ロール一覧の読み込みに失敗しました', '역할 목록 로드 실패', 'Error al cargar la lista de roles', 'Échec du chargement de la liste des rôles', 'Rollenliste konnte nicht geladen werden', 'Не удалось загрузить список ролей', 'Tải danh sách vai trò thất bại', 'โหลดรายการบทบาทไม่สำเร็จ'],
  ['请输入部门名称', '請輸入部門名稱', 'Please enter a department name', '部門名を入力してください', '부서명을 입력하세요', 'Introduzca el nombre del departamento', 'Veuillez saisir le nom du département', 'Bitte Abteilungsnamen eingeben', 'Введите название подразделения', 'Vui lòng nhập tên phòng ban', 'กรุณากรอกชื่อแผนก'],
  ['部门已保存', '部門已儲存', 'Department saved', '部門を保存しました', '부서가 저장되었습니다', 'Departamento guardado', 'Département enregistré', 'Abteilung gespeichert', 'Подразделение сохранено', 'Đã lưu phòng ban', 'บันทึกแผนกแล้ว'],
  ['删除部门「{name}」？', '刪除部門「{name}」？', 'Delete department "{name}"?', '部門「{name}」を削除しますか？', '부서 "{name}"을(를) 삭제하시겠습니까?', '¿Eliminar el departamento "{name}"?', 'Supprimer le département « {name} » ?', 'Abteilung „{name}“ löschen?', 'Удалить подразделение «{name}»?', 'Xóa phòng ban "{name}"?', 'ลบแผนก "{name}" หรือไม่?'],
  ['部门已删除', '部門已刪除', 'Department deleted', '部門を削除しました', '부서가 삭제되었습니다', 'Departamento eliminado', 'Département supprimé', 'Abteilung gelöscht', 'Подразделение удалено', 'Đã xóa phòng ban', 'ลบแผนกแล้ว'],
  ['请输入账号', '請輸入帳號', 'Please enter an account', 'アカウントを入力してください', '계정을 입력하세요', 'Introduzca la cuenta', 'Veuillez saisir le compte', 'Bitte Konto eingeben', 'Введите учётную запись', 'Vui lòng nhập tài khoản', 'กรุณากรอกบัญชี'],
  ['用户已保存', '使用者已儲存', 'User saved', 'ユーザーを保存しました', '사용자가 저장되었습니다', 'Usuario guardado', 'Utilisateur enregistré', 'Benutzer gespeichert', 'Пользователь сохранён', 'Đã lưu người dùng', 'บันทึกผู้ใช้แล้ว'],
  ['请填写编码与名称', '請填寫編碼與名稱', 'Please fill in code and name', 'コードと名称を入力してください', '코드와 이름을 입력하세요', 'Complete el código y el nombre', 'Veuillez saisir le code et le nom', 'Bitte Code und Name ausfüllen', 'Заполните код и название', 'Vui lòng nhập mã và tên', 'กรุณากรอกรหัสและชื่อ'],
  ['角色已创建', '角色已建立', 'Role created', 'ロールを作成しました', '역할이 생성되었습니다', 'Rol creado', 'Rôle créé', 'Rolle erstellt', 'Роль создана', 'Đã tạo vai trò', 'สร้างบทบาทแล้ว'],
  ['创建失败', '建立失敗', 'Creation failed', '作成に失敗しました', '생성 실패', 'Error al crear', 'Échec de la création', 'Erstellen fehlgeschlagen', 'Не удалось создать', 'Tạo thất bại', 'สร้างไม่สำเร็จ'],
  ['删除角色「{name}」？其下用户角色将清空', '刪除角色「{name}」？其下使用者角色將清空', 'Delete role "{name}"? Users under it will have their role cleared', 'ロール「{name}」を削除しますか？配下ユーザーのロールは空になります', '역할 "{name}"을(를) 삭제하시겠습니까? 해당 사용자의 역할이 비워집니다', '¿Eliminar el rol "{name}"? Se borrará el rol de sus usuarios', 'Supprimer le rôle « {name} » ? Le rôle de ses utilisateurs sera effacé', 'Rolle „{name}“ löschen? Die Rolle ihrer Benutzer wird geleert', 'Удалить роль «{name}»? У её пользователей роль будет очищена', 'Xóa vai trò "{name}"? Vai trò của người dùng thuộc vai trò này sẽ bị xóa', 'ลบบทบาท "{name}" หรือไม่? บทบาทของผู้ใช้ในบทบาทนี้จะถูกล้าง'],
  ['角色已删除', '角色已刪除', 'Role deleted', 'ロールを削除しました', '역할이 삭제되었습니다', 'Rol eliminado', 'Rôle supprimé', 'Rolle gelöscht', 'Роль удалена', 'Đã xóa vai trò', 'ลบบทบาทแล้ว'],
  ['面板权限加载失败', '面板權限載入失敗', 'Failed to load panel permissions', 'パネル権限の読み込みに失敗しました', '패널 권한 로드 실패', 'Error al cargar los permisos de panel', 'Échec du chargement des permissions de panneau', 'Panelberechtigungen konnten nicht geladen werden', 'Не удалось загрузить права на панели', 'Tải quyền bảng điều khiển thất bại', 'โหลดสิทธิ์แผงไม่สำเร็จ'],
  ['面板权限已保存', '面板權限已儲存', 'Panel permissions saved', 'パネル権限を保存しました', '패널 권한이 저장되었습니다', 'Permisos de panel guardados', 'Permissions de panneau enregistrées', 'Panelberechtigungen gespeichert', 'Права на панели сохранены', 'Đã lưu quyền bảng điều khiển', 'บันทึกสิทธิ์แผงแล้ว'],
]

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
let total = 0

L.forEach((loc, ci) => {
  const file = path.join(DIR, loc + '.js')
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  const bizIdx = lines.findIndex((l) => /^\s*biz:\s*\{/.test(l))
  if (bizIdx < 0) { console.log('  ⚠ ' + loc + ': 无 biz 块'); return }
  const missing = ROWS.filter((r) => !lines.some((l) => l.includes("'" + r[0] + "'")))
  if (!missing.length) { console.log('  = ' + loc + ': 已齐'); return }
  const ins = missing.map((r) => "    '" + esc(r[0]) + "': '" + esc(r[ci + 1]) + "',")
  lines.splice(bizIdx + 1, 0, ...ins)
  fs.writeFileSync(file, lines.join('\n'))
  total += missing.length
  console.log('  + ' + loc + ': 补 ' + missing.length + ' 条')
})
console.log('\n共写入 ' + total + ' 条')
