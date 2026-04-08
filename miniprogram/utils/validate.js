// 手机号验证
function isPhone(val) {
  return /^1[3-9]\d{9}$/.test(val);
}

// 正整数验证
function isPositiveInt(val) {
  return Number.isInteger(Number(val)) && Number(val) > 0;
}

// 需求录入表单验证
// 必填：受理区域、需求人联系方式、业务类型、需求类型、拟建位置详细描述
function validateDemandForm(form) {
  const errors = {};
  if (!form.acceptArea) errors.acceptArea = '请选择受理区域';
  if (!form.demandPersonPhone || !isPhone(form.demandPersonPhone)) errors.demandPersonPhone = '请输入正确的联系方式';
  if (!form.businessType) errors.businessType = '请选择业务类型';
  if (!form.demandType) errors.demandType = '请选择需求类型';
  if (!form.locationDetail) errors.locationDetail = '请填写详细描述';
  // 以下字段非必填，不再验证
  return { valid: Object.keys(errors).length === 0, errors };
}

// 设计查勘表单验证
function validateDesignForm(form) {
  const errors = {};
  if (form.hasResource === undefined || form.hasResource === null) {
    errors.hasResource = '请选择300M内是否有资源';
    return { valid: false, errors };
  }
  if (form.hasResource === true) {
    // 有资源时：必填现有资源名称，其他字段不验证
    if (!form.resourceName) errors.resourceName = '请填写现有资源名称';
  } else {
    // 无资源时：必填设计图纸（至少1张），照片和备注非必填
    if (!form.designFiles || form.designFiles.length === 0) errors.designFiles = '请上传设计图纸';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

// 施工信息验证
function validateConstructionForm(form) {
  const errors = {};
  if (!form.coverageName) errors.coverageName = '请填写建成覆盖范围名称';
  if (!form.photos || form.photos.length === 0) errors.photos = '请上传现场照片';
  if (!form.assetStatus) errors.assetStatus = '请选择资管生效状态';
  return { valid: Object.keys(errors).length === 0, errors };
}

module.exports = { isPhone, isPositiveInt, validateDemandForm, validateDesignForm, validateConstructionForm };
