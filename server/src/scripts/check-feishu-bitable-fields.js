require('dotenv').config();
const axios = require('axios');
const { getTenantAccessToken } = require('../utils/feishu');
const {
  FEISHU_FIELD_TYPE_HINTS,
  FEISHU_FIELD_OPTION_HINTS
} = require('../utils/feishu-bitable');

const UI_TYPE_BY_EXPECTED_TYPE = {
  '单行文本': ['Text'],
  '多行文本': ['Text'],
  '数字': ['Number'],
  '日期时间': ['DateTime'],
  '单选': ['SingleSelect'],
  '附件': ['Attachment'],
  '复选框': ['Checkbox']
};

function normalizeOptions(options) {
  return (options || []).map(item => item.name).sort();
}

function arraysEqual(left, right) {
  if (left.length !== right.length) return false;
  return left.every((item, index) => item === right[index]);
}

async function fetchAllFields(token, appToken, tableId) {
  const items = [];
  let pageToken;

  while (true) {
    const res = await axios.get(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          page_size: 200,
          page_token: pageToken
        }
      }
    );

    if (res.data?.code !== 0) {
      throw new Error(`获取飞书字段列表失败: ${res.data?.msg || '未知错误'}`);
    }

    items.push(...(res.data?.data?.items || []));
    if (!res.data?.data?.has_more) {
      return items;
    }
    pageToken = res.data?.data?.page_token;
  }
}

function buildReport(fields) {
  const actualMap = new Map(fields.map(field => [field.field_name, field]));
  const expectedEntries = Object.entries(FEISHU_FIELD_TYPE_HINTS);
  const missing = [];
  const typeMismatch = [];
  const optionMismatch = [];
  const passed = [];

  for (const [fieldName, expectedType] of expectedEntries) {
    const actualField = actualMap.get(fieldName);
    if (!actualField) {
      missing.push({
        fieldName,
        expectedType
      });
      continue;
    }

    const acceptableUiTypes = UI_TYPE_BY_EXPECTED_TYPE[expectedType] || [];
    if (!acceptableUiTypes.includes(actualField.ui_type)) {
      typeMismatch.push({
        fieldName,
        expectedType,
        actualUiType: actualField.ui_type
      });
      continue;
    }

    const expectedOptions = FEISHU_FIELD_OPTION_HINTS[fieldName];
    if (expectedOptions) {
      const actualOptions = normalizeOptions(actualField.property?.options);
      const normalizedExpectedOptions = [...expectedOptions].sort();
      if (!arraysEqual(actualOptions, normalizedExpectedOptions)) {
        optionMismatch.push({
          fieldName,
          expectedOptions: normalizedExpectedOptions,
          actualOptions
        });
        continue;
      }
    }

    passed.push({
      fieldName,
      expectedType,
      actualUiType: actualField.ui_type
    });
  }

  return {
    summary: {
      expectedFieldCount: expectedEntries.length,
      actualFieldCount: fields.length,
      passedCount: passed.length,
      missingCount: missing.length,
      typeMismatchCount: typeMismatch.length,
      optionMismatchCount: optionMismatch.length
    },
    missing,
    typeMismatch,
    optionMismatch,
    passed
  };
}

async function run() {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const tableId = process.env.FEISHU_BITABLE_TABLE_ID;

  if (!appToken || !tableId) {
    throw new Error('缺少 FEISHU_BITABLE_APP_TOKEN 或 FEISHU_BITABLE_TABLE_ID 配置');
  }

  const token = await getTenantAccessToken();
  const fields = await fetchAllFields(token, appToken, tableId);
  const report = buildReport(fields);

  console.log(JSON.stringify({
    appToken,
    tableId,
    ...report
  }, null, 2));

  if (
    report.summary.missingCount > 0 ||
    report.summary.typeMismatchCount > 0 ||
    report.summary.optionMismatchCount > 0
  ) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
