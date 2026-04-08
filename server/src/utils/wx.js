const axios = require('axios');
const { logger } = require('./logger');

const WX_CODE2SESSION_URL = 'https://api.weixin.qq.com/sns/jscode2session';
const WX_PHONE_URL = 'https://api.weixin.qq.com/wxa/business/getuserphonenumber';

let accessToken = null;
let tokenExpireTime = 0;

/**
 * 获取微信 access_token（内存缓存，过期自动刷新）
 */
async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpireTime) {
    return accessToken;
  }
  const res = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
    params: {
      grant_type: 'client_credential',
      appid: process.env.WX_APP_ID,
      secret: process.env.WX_APP_SECRET
    }
  });
  if (res.data.errcode) {
    throw new Error(`获取access_token失败: ${res.data.errmsg}`);
  }
  accessToken = res.data.access_token;
  // 提前5分钟过期
  tokenExpireTime = Date.now() + (res.data.expires_in - 300) * 1000;
  return accessToken;
}

/**
 * 通过 code 获取 openid
 * @param {string} code - wx.login 返回的 code
 */
async function code2Session(code) {
  const res = await axios.get(WX_CODE2SESSION_URL, {
    params: {
      appid: process.env.WX_APP_ID,
      secret: process.env.WX_APP_SECRET,
      js_code: code,
      grant_type: 'authorization_code'
    }
  });
  if (res.data.errcode) {
    throw new Error(`code2session失败: ${res.data.errmsg}`);
  }
  return res.data.openid;
}

/**
 * 通过 code 获取用户手机号
 * @param {string} code - getPhoneNumber 返回的 code
 */
async function getPhoneNumber(code) {
  const token = await getAccessToken();
  const res = await axios.post(
    `${WX_PHONE_URL}?access_token=${token}`,
    { code }
  );
  if (res.data.errcode) {
    throw new Error(`获取手机号失败: ${res.data.errmsg}`);
  }
  return res.data.phone_info.purePhoneNumber;
}

module.exports = { code2Session, getPhoneNumber };
