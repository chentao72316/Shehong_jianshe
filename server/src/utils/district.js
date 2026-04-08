/**
 * district.js
 * 区县过滤工具 —— 统一处理所有路由的 district 维度隔离逻辑
 *
 * 规则：
 *   ADMIN：取 req.query.district（可选；不传则不加过滤，即全量可见）
 *   其他角色：强制取 req.user.district（只能看自己所属区县）
 */

/** 遂宁市所辖区县 */
const DISTRICTS = ['射洪市', '蓬溪县', '大英县', '船山区', '安居区'];

/**
 * 返回应添加到 Mongoose 查询的 district 过滤对象。
 * 结果直接 Object.assign 到查询条件中即可。
 *
 * @param {import('express').Request} req
 * @returns {{ district?: string }}   空对象表示全量（ADMIN 未指定区县）
 */
function getDistrictFilter(req) {
  const roles = req.user?.roles || [];
  if (roles.includes('ADMIN')) {
    const d = req.query.district;
    return d ? { district: d } : {};
  }
  // 非 ADMIN：强制限制到本人所属区县（兜底为射洪市，保持向后兼容）
  return { district: req.user?.district || '射洪市' };
}

/**
 * 从 req.body 中安全取出 district 字段。
 * ADMIN 可自定义，其他角色强制使用自身 district。
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
function getDistrictFromBody(req) {
  const roles = req.user?.roles || [];
  if (roles.includes('ADMIN') && req.body.district) {
    return req.body.district;
  }
  return req.user?.district || '射洪市';
}

module.exports = { DISTRICTS, getDistrictFilter, getDistrictFromBody };
