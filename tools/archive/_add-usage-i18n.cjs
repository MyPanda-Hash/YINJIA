/* 为 9 个语言包插入「使用权限查看」页面词条(插在「组织架构」词条行后) */
const fs = require('fs')
const dir = 'C:/INCER/YINJIA-MES/frontend/src/i18n/locales/'

const T = {
  en: { '使用权限查看': 'Usage Review', '面板名': 'Panel Name', '按钮/动作': 'Button / Action', '来源IP': 'Source IP', '操作时间': 'Operation Time', '登录': 'Login', '操作': 'Operation', '单据号': 'Doc No', '动作': 'Action' },
  ja: { '使用权限查看': '使用権限の確認', '面板名': 'パネル名', '按钮/动作': 'ボタン/操作', '来源IP': '発信元IP', '操作时间': '操作時間', '登录': 'ログイン', '操作': '操作', '单据号': '伝票番号', '动作': '操作' },
  ko: { '使用权限查看': '사용 권한 보기', '面板名': '패널 이름', '按钮/动作': '버튼/작업', '来源IP': '출처 IP', '操作时间': '작업 시간', '登录': '로그인', '操作': '작업', '单据号': '전표 번호', '动作': '동작' },
  de: { '使用权限查看': 'Nutzungsrechte anzeigen', '面板名': 'Panelname', '按钮/动作': 'Schaltfläche/Aktion', '来源IP': 'Quell-IP', '操作时间': 'Operationszeit', '登录': 'Anmelden', '操作': 'Operation', '单据号': 'Belegnr.', '动作': 'Aktion' },
  es: { '使用权限查看': 'Ver uso de permisos', '面板名': 'Nombre del panel', '按钮/动作': 'Botón/Acción', '来源IP': 'IP de origen', '操作时间': 'Hora de operación', '登录': 'Iniciar sesión', '操作': 'Operación', '单据号': 'N.º de documento', '动作': 'Acción' },
  fr: { '使用权限查看': 'Voir l’utilisation des droits', '面板名': 'Nom du panneau', '按钮/动作': 'Bouton/Action', '来源IP': 'IP source', '操作时间': 'Heure d’opération', '登录': 'Connexion', '操作': 'Opération', '单据号': 'N° de pièce', '动作': 'Action' },
  ru: { '使用权限查看': 'Просмотр использования прав', '面板名': 'Имя панели', '按钮/动作': 'Кнопка/Действие', '来源IP': 'IP источника', '操作时间': 'Время операции', '登录': 'Вход', '操作': 'Операция', '单据号': '№ документа', '动作': 'Действие' },
  th: { '使用权限查看': 'ดูการใช้งานสิทธิ์', '面板名': 'ชื่อแผง', '按钮/动作': 'ปุ่ม/การกระทำ', '来源IP': 'IP ต้นทาง', '操作时间': 'เวลาดำเนินการ', '登录': 'เข้าสู่ระบบ', '操作': 'การดำเนินการ', '单据号': 'เลขที่เอกสาร', '动作': 'การกระทำ' },
  vi: { '使用权限查看': 'Xem quyền sử dụng', '面板名': 'Tên bảng', '按钮/动作': 'Nút/Hành động', '来源IP': 'IP nguồn', '操作时间': 'Thời gian thao tác', '登录': 'Đăng nhập', '操作': 'Thao tác', '单据号': 'Số chứng từ', '动作': 'Hành động' },
}

for (const loc of Object.keys(T)) {
  const f = dir + loc + '.js'
  let s = fs.readFileSync(f, 'utf8')
  const lines = []
  for (const w of Object.keys(T[loc])) {
    if (!s.includes("'" + w + "'")) {
      const linesToAdd = "    '" + w + "': '" + T[loc][w] + "',\n"
      lines.push(linesToAdd)
    }
  }
  if (!lines.length) { console.log(loc + ': nothing to add'); continue }
  const insert = lines.join('')
  const re = /('组织架构': [^\n]*\n)/
  if (!re.test(s)) { console.log(loc + ': anchor not found!'); continue }
  s = s.replace(re, '$1' + insert)
  fs.writeFileSync(f, s, 'utf8')
  console.log(loc + ': added ' + lines.length + ' entries')
}
