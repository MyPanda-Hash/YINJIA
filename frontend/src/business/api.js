import request from '@core/request'

export async function apiLogin(payload) {
  const res = await request.post('/auth/login', payload)
  if (res?.code && res.code !== 200) throw new Error(res.message || '登录失败')
  return res?.data ?? res
}

export async function apiGetPerms() {
  const res = await request.get('/auth/perms')
  return res?.data ?? res
}

/** 自助改密(2026-10-15):原密码由服务端 encoder.matches 校验,不再前端硬编码。 */
export async function apiChangePassword(payload) {
  const res = await request.post('/auth/changePassword', payload)
  if (res?.code && res.code !== 200) throw new Error(res.message || '修改密码失败')
  return res?.data ?? res
}

export async function apiGetUserInfo() {
  const res = await request.get('/auth/userinfo')
  return res?.data ?? res
}

export async function apiGetMenus() {
  const res = await request.get('/sys/menu/tree')
  return res?.data ?? res
}

export async function apiGetFactories() {
  const res = await request.get('/base/factory/list')
  return res?.data ?? res
}

export async function apiGetBadge() {
  const res = await request.get('/portal/badge')
  return res?.data ?? res
}

export async function apiGetNotices(type) {
  const res = await request.get('/portal/notice/list', { params: { type } })
  return res?.data ?? res
}

// ---- 业务事件消息(2026-09-09) ----
export async function apiGetMessages({ onlyUnread = false, limit = 100 } = {}) {
  const res = await request.get('/portal/message/list', { params: { onlyUnread, limit } })
  return res?.data ?? res
}

export async function apiReadMessage(id) {
  const res = await request.post('/portal/message/read', { id })
  return res?.data ?? res
}

export async function apiReadAllMessages() {
  const res = await request.post('/portal/message/readAll', {})
  return res?.data ?? res
}

// 2026-10-28:旧生产加工单 MANU_ORDER 下架,其 /manu/order/* 五个接口封装一并删除
// (后端从来没有这些端点;唯一调用方 TabsBar 的「快速查找」也已移除)。
