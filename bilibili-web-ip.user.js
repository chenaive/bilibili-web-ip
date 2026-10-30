// ==UserScript==
// @name         Bili 属地助手（评论、空间、UP主与动态）
// @namespace    local.bili-location-helper
// @version      1.1
// @description  展示B站已公开的IP属地；账号属地需主动授权。本地缓存、限速，不打开用户主页。
// @match        https://www.bilibili.com/*
// @match        https://space.bilibili.com/*
// @match        https://t.bilibili.com/*
// @match        https://m.bilibili.com/*
// @match        https://search.bilibili.com/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @connect      app.bilibili.com
// @connect      passport.bilibili.com
// @noframes
// @license      MIT
// ==/UserScript==
/*
Original integration: Bili 属地助手, 2026, MIT.
Bundled libBilibiliToken, Copyright (c) lzghzr, MIT.
Source: https://github.com/lzghzr/TampermonkeyJS/blob/5f3e2f18294de581088ca17e4f31b4a217cfec7a/libBilibiliToken/libBilibiliToken.js
Includes JavaScript MD5, Copyright 2011 Sebastian Tschan, https://blueimp.net (MIT),
based on Paul Johnston et al. (BSD). See embedded attribution and THIRD-PARTY-NOTICES.txt.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

(() => {

class BilibiliToken {
  static _W = typeof unsafeWindow === 'undefined' ? window : unsafeWindow;
  static __loginSecretKey = '2653583c8873dea268ab9386918b1d65';
  static loginAppKey = '783bbb7264451d82';
  static __secretKey = '560c52ccd288fed045859ed18bffd973';
  static appKey = '1d8b6e7d45233436';
  build = '6720300';
  buvid = BilibiliToken.buvidXX;
  Clocale = 'zh-Hans_CN';
  channel = 'website';
  localId = this.buvid;
  mobiApp = 'android';
  platform = 'android';
  Slocale = 'zh-Hans_CN';
  static get buvidXX() {
    const buvid = this.md5(Math.random().toString()).toUpperCase();
    return 'XX' + buvid[2] + buvid[12] + buvid[22] + buvid;
  }
  static get TS() { return Math.floor(Date.now() / 1000); }
  headers = {
    'user-agent': 'Mozilla/5.0 BiliDroid/6.72.0 (bbcallen@gmail.com) os/android model/XQ-CT72 mobi_app/android build/6720300 channel/bilih5 innerVer/6720310 osVer/12 network/2',
    'buvid': this.buvid
  };
  get loginQuery() {
    return `appkey=${BilibiliToken.loginAppKey}&build=${this.build}&c_locale=${this.Clocale}&channel=${this.channel}&local_id=${this.localId}\
&mobi_app=${this.mobiApp}&platform=${this.platform}&s_locale=${this.Slocale}`;
  }
  static signQuery(params, ts = true, secretKey = this.__secretKey) {
    let paramsSort = params;
    if (ts)
      paramsSort = `${params}&ts=${this.TS}`;
    paramsSort = paramsSort.split('&').sort().join('&');
    const paramsSecret = paramsSort + secretKey;
    const paramsHash = this.md5(paramsSecret);
    return `${paramsSort}&sign=${paramsHash}`;
  }
  signLoginQuery(params) {
    const paramsBase = params === undefined ? this.loginQuery : `${params}&${this.loginQuery}`;
    return BilibiliToken.signQuery(paramsBase, true, BilibiliToken.__loginSecretKey);
  }
  async getAuthCode() {
    const authCode = await BilibiliToken.XHR({
      GM: true,
      anonymous: true,
      method: 'POST',
      url: 'https://passport.bilibili.com/x/passport-tv-login/qrcode/auth_code',
      data: this.signLoginQuery(),
      responseType: 'json',
      headers: this.headers
    });
    if (authCode !== undefined && authCode.response.status === 200 && authCode.body.code === 0)
      return authCode.body.data.auth_code;
    return console.error(GM_info.script.name, 'getAuthCode', authCode);
  }
  async qrcodeConfirm(authCode, csrf) {
    const confirm = await BilibiliToken.XHR({
      GM: true,
      method: 'POST',
      url: 'https://passport.bilibili.com/x/passport-tv-login/h5/qrcode/confirm',
      data: `auth_code=${authCode}&csrf=${csrf}&scanning_type=1`,
      responseType: 'json',
      headers: this.headers
    });
    if (confirm !== undefined && confirm.response.status === 200 && confirm.body.code === 0)
      return confirm.body.data.gourl;
    return console.error(GM_info.script.name, 'qrcodeConfirm', confirm);
  }
  async qrcodePoll(authCode) {
    const poll = await BilibiliToken.XHR({
      GM: true,
      anonymous: true,
      method: 'POST',
      url: 'https://passport.bilibili.com/x/passport-tv-login/qrcode/poll',
      data: this.signLoginQuery(`auth_code=${authCode}`),
      responseType: 'json',
      headers: this.headers
    });
    if (poll !== undefined && poll.response.status === 200 && poll.body.code === 0)
      return poll.body.data;
    return console.error(GM_info.script.name, 'qrcodePoll', poll);
  }
  async getToken() {
    const cookie = BilibiliToken._W.document.cookie.match(/bili_jct=(?<csrf>.*?);/);
    if (cookie === null || cookie.groups === undefined)
      return console.error(GM_info.script.name, 'getToken', 'cookie获取失败');
    const csrf = cookie.groups['csrf'];
    const authCode = await this.getAuthCode();
    if (authCode === undefined)
      return;
    const confirm = await this.qrcodeConfirm(authCode, csrf);
    if (confirm === undefined)
      return;
    const token = await this.qrcodePoll(authCode);
    if (token === undefined)
      return;
    return token;
  }
  static md5(string, key, raw) {
    return md5(string, key, raw);
    function safeAdd(x, y) {
      var lsw = (x & 0xffff) + (y & 0xffff);
      var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
      return (msw << 16) | (lsw & 0xffff);
    }
    function bitRotateLeft(num, cnt) {
      return (num << cnt) | (num >>> (32 - cnt));
    }
    function md5cmn(q, a, b, x, s, t) {
      return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
    }
    function md5ff(a, b, c, d, x, s, t) {
      return md5cmn((b & c) | (~b & d), a, b, x, s, t);
    }
    function md5gg(a, b, c, d, x, s, t) {
      return md5cmn((b & d) | (c & ~d), a, b, x, s, t);
    }
    function md5hh(a, b, c, d, x, s, t) {
      return md5cmn(b ^ c ^ d, a, b, x, s, t);
    }
    function md5ii(a, b, c, d, x, s, t) {
      return md5cmn(c ^ (b | ~d), a, b, x, s, t);
    }
    function binlMD5(x, len) {
      x[len >> 5] |= 0x80 << len % 32;
      x[(((len + 64) >>> 9) << 4) + 14] = len;
      var i;
      var olda;
      var oldb;
      var oldc;
      var oldd;
      var a = 1732584193;
      var b = -271733879;
      var c = -1732584194;
      var d = 271733878;
      for (i = 0; i < x.length; i += 16) {
        olda = a;
        oldb = b;
        oldc = c;
        oldd = d;
        a = md5ff(a, b, c, d, x[i], 7, -680876936);
        d = md5ff(d, a, b, c, x[i + 1], 12, -389564586);
        c = md5ff(c, d, a, b, x[i + 2], 17, 606105819);
        b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330);
        a = md5ff(a, b, c, d, x[i + 4], 7, -176418897);
        d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426);
        c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341);
        b = md5ff(b, c, d, a, x[i + 7], 22, -45705983);
        a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416);
        d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417);
        c = md5ff(c, d, a, b, x[i + 10], 17, -42063);
        b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162);
        a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682);
        d = md5ff(d, a, b, c, x[i + 13], 12, -40341101);
        c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290);
        b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329);
        a = md5gg(a, b, c, d, x[i + 1], 5, -165796510);
        d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632);
        c = md5gg(c, d, a, b, x[i + 11], 14, 643717713);
        b = md5gg(b, c, d, a, x[i], 20, -373897302);
        a = md5gg(a, b, c, d, x[i + 5], 5, -701558691);
        d = md5gg(d, a, b, c, x[i + 10], 9, 38016083);
        c = md5gg(c, d, a, b, x[i + 15], 14, -660478335);
        b = md5gg(b, c, d, a, x[i + 4], 20, -405537848);
        a = md5gg(a, b, c, d, x[i + 9], 5, 568446438);
        d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690);
        c = md5gg(c, d, a, b, x[i + 3], 14, -187363961);
        b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501);
        a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467);
        d = md5gg(d, a, b, c, x[i + 2], 9, -51403784);
        c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473);
        b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734);
        a = md5hh(a, b, c, d, x[i + 5], 4, -378558);
        d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463);
        c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562);
        b = md5hh(b, c, d, a, x[i + 14], 23, -35309556);
        a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060);
        d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353);
        c = md5hh(c, d, a, b, x[i + 7], 16, -155497632);
        b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640);
        a = md5hh(a, b, c, d, x[i + 13], 4, 681279174);
        d = md5hh(d, a, b, c, x[i], 11, -358537222);
        c = md5hh(c, d, a, b, x[i + 3], 16, -722521979);
        b = md5hh(b, c, d, a, x[i + 6], 23, 76029189);
        a = md5hh(a, b, c, d, x[i + 9], 4, -640364487);
        d = md5hh(d, a, b, c, x[i + 12], 11, -421815835);
        c = md5hh(c, d, a, b, x[i + 15], 16, 530742520);
        b = md5hh(b, c, d, a, x[i + 2], 23, -995338651);
        a = md5ii(a, b, c, d, x[i], 6, -198630844);
        d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415);
        c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905);
        b = md5ii(b, c, d, a, x[i + 5], 21, -57434055);
        a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571);
        d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606);
        c = md5ii(c, d, a, b, x[i + 10], 15, -1051523);
        b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799);
        a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359);
        d = md5ii(d, a, b, c, x[i + 15], 10, -30611744);
        c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380);
        b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649);
        a = md5ii(a, b, c, d, x[i + 4], 6, -145523070);
        d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379);
        c = md5ii(c, d, a, b, x[i + 2], 15, 718787259);
        b = md5ii(b, c, d, a, x[i + 9], 21, -343485551);
        a = safeAdd(a, olda);
        b = safeAdd(b, oldb);
        c = safeAdd(c, oldc);
        d = safeAdd(d, oldd);
      }
      return [a, b, c, d];
    }
    function binl2rstr(input) {
      var i;
      var output = '';
      var length32 = input.length * 32;
      for (i = 0; i < length32; i += 8) {
        output += String.fromCharCode((input[i >> 5] >>> i % 32) & 0xff);
      }
      return output;
    }
    function rstr2binl(input) {
      var i;
      var output = [];
      output[(input.length >> 2) - 1] = undefined;
      for (i = 0; i < output.length; i += 1) {
        output[i] = 0;
      }
      var length8 = input.length * 8;
      for (i = 0; i < length8; i += 8) {
        output[i >> 5] |= (input.charCodeAt(i / 8) & 0xff) << i % 32;
      }
      return output;
    }
    function rstrMD5(s) {
      return binl2rstr(binlMD5(rstr2binl(s), s.length * 8));
    }
    function rstrHMACMD5(key, data) {
      var i;
      var bkey = rstr2binl(key);
      var ipad = [];
      var opad = [];
      var hash;
      ipad[15] = opad[15] = undefined;
      if (bkey.length > 16) {
        bkey = binlMD5(bkey, key.length * 8);
      }
      for (i = 0; i < 16; i += 1) {
        ipad[i] = bkey[i] ^ 0x36363636;
        opad[i] = bkey[i] ^ 0x5c5c5c5c;
      }
      hash = binlMD5(ipad.concat(rstr2binl(data)), 512 + data.length * 8);
      return binl2rstr(binlMD5(opad.concat(hash), 512 + 128));
    }
    function rstr2hex(input) {
      var hexTab = '0123456789abcdef';
      var output = '';
      var x;
      var i;
      for (i = 0; i < input.length; i += 1) {
        x = input.charCodeAt(i);
        output += hexTab.charAt((x >>> 4) & 0x0f) + hexTab.charAt(x & 0x0f);
      }
      return output;
    }
    function str2rstrUTF8(input) {
      return unescape(encodeURIComponent(input));
    }
    function rawMD5(s) {
      return rstrMD5(str2rstrUTF8(s));
    }
    function hexMD5(s) {
      return rstr2hex(rawMD5(s));
    }
    function rawHMACMD5(k, d) {
      return rstrHMACMD5(str2rstrUTF8(k), str2rstrUTF8(d));
    }
    function hexHMACMD5(k, d) {
      return rstr2hex(rawHMACMD5(k, d));
    }
    function md5(string, key, raw) {
      if (!key) {
        if (!raw) {
          return hexMD5(string);
        }
        return rawMD5(string);
      }
      if (!raw) {
        return hexHMACMD5(key, string);
      }
      return rawHMACMD5(key, string);
    }
  }
  static XHR(XHROptions) {
    return new Promise(resolve => {
      const onerror = (error) => {
        console.error(GM_info.script.name, error);
        resolve(undefined);
      };
      if (XHROptions.GM) {
        if (XHROptions.method === 'POST') {
          if (XHROptions.headers === undefined)
            XHROptions.headers = {};
          if (XHROptions.headers['Content-Type'] === undefined)
            XHROptions.headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=utf-8';
        }
        XHROptions.timeout = 30 * 1000;
        XHROptions.onload = res => resolve({ response: res, body: res.response });
        XHROptions.onerror = onerror;
        XHROptions.ontimeout = onerror;
        GM_xmlhttpRequest(XHROptions);
      }
      else {
        const xhr = new XMLHttpRequest();
        xhr.open(XHROptions.method, XHROptions.url);
        if (XHROptions.method === 'POST' && xhr.getResponseHeader('Content-Type') === null)
          xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=utf-8');
        if (XHROptions.withCredentials)
          xhr.withCredentials = true;
        if (XHROptions.responseType !== undefined)
          xhr.responseType = XHROptions.responseType;
        xhr.timeout = 30 * 1000;
        xhr.onload = ev => {
          const res = ev.target;
          resolve({ response: res, body: res.response });
        };
        xhr.onerror = onerror;
        xhr.ontimeout = onerror;
        xhr.send(XHROptions.data);
      }
    });
  }
}
/* Bili 属地助手 — original integration, MIT. API field references: see README. */
(() => {
  'use strict';
  const W = typeof unsafeWindow === 'undefined' ? window : unsafeWindow;
  const DAY = 86400000, VERSION = '1.1';
  const get = (k, d) => { try { return GM_getValue(k, d); } catch { return d; } };
  const set = (k, v) => GM_setValue(k, v);
  let token = get('accessKey', ''), epoch = 0;
  let cache = get('profiles', {}), pausedUntil = 0;
  let stats = { requests: 0, bytes: 0, hits: 0, comments: 0, posts: 0 };
  let status = token ? '账号属地授权已保存，等待查询' : '评论和动态优先读取页面数据；账号属地需要授权';
  const replies = new Map(), posts = new Map(), videos = new Map(), pending = new Map(), failures = new Map();
  const failureReasons = new Map();
  const roots = new Set(), watched = new WeakMap();
  const cardAnchors = new Map(), cardObserved = new WeakSet(), visibleCards = new WeakSet();
  const reservedCards = new Set();
  const accountLabels = new Map();
  const cardLabelTargets = new Map();
  let pageReady = false;
  let cardEnabled = get('cardEnabled', true), cardLimit = 20;
  let chain = Promise.resolve(), timer, scanning = false, lastURL = location.href, lastInitial;
  function clean(x) {
    if (typeof x !== 'string') return '';
    return x.replace(/^\s*IP\s*属地\s*[:：]?\s*/i, '').trim().slice(0, 60);
  }
  function profileLocation(data) {
    const card = data?.card;
    for (const tag of [...(card?.space_tag || []), ...(card?.space_tag_bottom || [])]) {
      if (tag?.type === 'location' && clean(tag.title)) return clean(tag.title);
    }
    return '';
  }
  const id = x => typeof x === 'string' && /^\d+$/.test(x) ? x :
    typeof x === 'number' && Number.isSafeInteger(x) && x >= 0 ? String(x) : '';
  function remember(map, key, value) {
    if (!key || !value) return;
    map.set(key, value);
    if (map.size > 3000) map.delete(map.keys().next().value);
  }
  // Only consume explicit location fields. Never join comment records by account UID.
  function ingest(data) {
    const seen = new WeakSet(); let count = 0;
    function visit(x, depth) {
      if (!x || typeof x !== 'object' || depth > 18 || seen.has(x) || ++count > 25000) return;
      seen.add(x);
      const rid = id(x.rpid_str) || id(x.rpid);
      if (rid) remember(replies, rid, clean(x.reply_control?.location));
      const did = id(x.id_str);
      if (did && x.modules?.module_author) remember(posts, did, clean(x.modules.module_author.pub_location_text));
      const owner = id(x.owner?.mid);
      if (owner) { remember(videos, x.bvid, owner); remember(videos, id(x.aid), owner); }
      for (const v of Object.values(x)) if (v && typeof v === 'object') visit(v, depth + 1);
    }
    visit(data, 0); schedule();
  }
  // Deliberately do NOT replace fetch, XHR, customElements.define or Lit update.
  // Component data and initial state are read passively after native rendering.
  function request(url, options = {}) {
    return new Promise((resolve, reject) => {
      stats.requests++;
      GM_xmlhttpRequest({ method: options.data ? 'POST' : 'GET', url, timeout: 15000,
        anonymous: options.anonymous !== false,
        headers: options.data ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {},
        data: options.data,
        onload(r) {
          stats.bytes += new TextEncoder().encode(r.responseText || '').length;
          if (r.status === 429 || r.status === 403 || r.status === 412) {
            pausedUntil = Date.now() + 10 * 60000;
            reject(new Error('接口限流，暂停查询十分钟')); return;
          }
          if (r.status < 200 || r.status >= 300) { reject(new Error('接口 HTTP ' + r.status)); return; }
          try { resolve(JSON.parse(r.responseText)); } catch { reject(new Error('接口没有返回有效数据')); }
        }, onerror: () => reject(new Error('网络请求失败')), ontimeout: () => reject(new Error('请求超时')),
        onabort: () => reject(new Error('请求已取消')) });
    });
  }
  function prune() {
    cache = Object.fromEntries(Object.entries(cache).filter(([, v]) => v && Date.now() - v.time < DAY)
      .sort((a, b) => b[1].time - a[1].time).slice(0, 500));
    set('profiles', cache);
  }
  function lookup(uid, wanted = () => true) {
    if (!id(uid)) return Promise.resolve(null);
    if (cache[uid] && Date.now() - cache[uid].time < (cache[uid].location ? DAY : 30 * 60000)) {
      stats.hits++; return Promise.resolve(cache[uid]);
    }
    if (!token || Date.now() < pausedUntil || Date.now() < (failures.get(uid) || 0)) return Promise.resolve(null);
    if (pending.has(uid)) return pending.get(uid);
    const mine = epoch;
    const job = chain.then(async () => {
      if (mine !== epoch || !token || Date.now() < pausedUntil || !wanted()) return null;
      const query = BilibiliToken.signQuery(new URLSearchParams({ access_key: token,
        appkey: BilibiliToken.appKey, build: '6720300', mobi_app: 'android', vmid: uid }).toString());
      try {
        const res = await request('https://app.bilibili.com/x/v2/space?' + query);
        if (mine !== epoch) return null;
        if (res.code !== 0) {
          if ([-101, -400, -401, -3, -352, -412, -509, -799].includes(res.code)) pausedUntil = Date.now() + 10 * 60000;
          throw new Error('账号属地接口返回 ' + res.code + '；请检查授权或稍后再试');
        }
        const value = { location: profileLocation(res.data), time: Date.now() };
        cache[uid] = value; prune();
        status = value.location ? '账号属地查询成功' : '接口未提供该用户的账号属地';
        return value;
      } catch (e) {
        if (mine !== epoch) return null;
        failures.set(uid, Date.now() + 5 * 60000); failureReasons.set(uid, e.message); status = e.message; return null;
      }
    });
    pending.set(uid, job);
    chain = job.catch(() => {}).then(() => new Promise(r => setTimeout(r, 1800)));
    job.finally(() => { pending.delete(uid); schedule(); });
    return job;
  }
  // Explicit user action only. Credentials stay in userscript-manager storage.
  async function authorize(button) {
    const consent = document.querySelector('#bl-consent');
    if (!consent?.checked) { status = '请先阅读并勾选授权说明'; refreshPanel(); return; }
    button.disabled = true; status = '正在向 B 站申请客户端授权…'; refreshPanel();
    try {
      const csrf = W.document.cookie.match(/(?:^|;\s*)bili_jct=([^;]+)/)?.[1];
      if (!csrf) throw new Error('请先在当前浏览器登录 B 站，再重试');
      const client = new BilibiliToken();
      const a = await request('https://passport.bilibili.com/x/passport-tv-login/qrcode/auth_code',
        { data: client.signLoginQuery() });
      if (a.code !== 0 || !a.data?.auth_code) throw new Error('B 站未批准授权申请：' + a.code);
      const b = await request('https://passport.bilibili.com/x/passport-tv-login/h5/qrcode/confirm',
        { anonymous: false, data: new URLSearchParams({ auth_code: a.data.auth_code, csrf, scanning_type: '1' }).toString() });
      if (b.code !== 0) throw new Error('B 站未确认授权：' + b.code);
      const c = await request('https://passport.bilibili.com/x/passport-tv-login/qrcode/poll',
        { data: client.signLoginQuery('auth_code=' + encodeURIComponent(a.data.auth_code)) });
      const key = c.data?.access_token || c.data?.token_info?.access_token;
      if (c.code !== 0 || typeof key !== 'string' || !key) throw new Error('未取得客户端凭证：' + c.code);
      token = key; set('accessKey', key); epoch++; cache = {}; prune(); failures.clear(); failureReasons.clear(); pausedUntil = 0;
      status = '授权已保存，仅用于向 B 站查询公开属地'; schedule();
    } catch (e) { status = e.message + '。可继续使用无需授权的评论显示。'; }
    finally { button.disabled = false; refreshPanel(); }
  }
  function decorate(anchor, kind, value, title = '') {
    if (!anchor?.parentNode) return;
    const parent = anchor.parentNode;
    let badge = [...parent.children].find(x => x.classList.contains('bl-location') && x.dataset.kind === kind);
    if (!value) { badge?.remove(); return; }
    if (!badge) {
      badge = document.createElement('span'); badge.className = 'bl-location'; badge.dataset.kind = kind;
      badge.style.cssText = 'display:inline-block;flex-shrink:0;font-size:12px;line-height:1.6;margin:0 5px;color:#888;white-space:nowrap;vertical-align:middle;';
      parent.insertBefore(badge, anchor.nextSibling);
      if (kind === 'comment') stats.comments++;
      if (kind === 'post') stats.posts++;
    }
    const text = 'IP：' + value;
    if (badge.textContent !== text) badge.textContent = text;
    if (badge.title !== title) badge.title = title;
  }
  function cardLayoutStyle() {
    if (document.querySelector('#bl-card-layout')) return;
    const style = document.createElement('style'); style.id = 'bl-card-layout';
    style.textContent = `
      .bl-card-owner { position:relative!important;display:block!important;box-sizing:border-box!important;
        min-width:0!important;max-width:100%!important;width:100%!important;
        padding-right:var(--bl-ip-space,68px)!important;white-space:nowrap!important;
        overflow:hidden!important;text-overflow:ellipsis!important; }
      .bl-account-label::after { content:attr(data-bl-account-label);display:inline-block;
        font-size:12px;color:#888;white-space:nowrap;margin-left:5px; }
      .bl-card-owner::after { position:absolute!important;right:0!important;top:50%!important;
        transform:translateY(-50%);max-width:42%;margin:0!important;overflow:hidden;
        text-overflow:ellipsis;white-space:nowrap!important;line-height:inherit!important; }
      .bl-card-owner > .name,.bl-card-owner > .bili-video-card__info--author {
        display:inline-block!important;max-width:calc(100% - 22px)!important;min-width:0;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle; }
      .bl-card-owner > svg,.bl-card-owner > i { vertical-align:middle; }
      .bl-card-owner.bl-aicu-reserve {padding-right:calc(var(--bl-ip-space,68px) + 40px)!important;}
      .bl-card-owner.bl-aicu-reserve::after {right:40px!important;}
      .bl-sidebar-ip::after { display:block!important;position:static!important;transform:none!important;
        max-width:100%;margin:4px 0 0!important;font-size:12px;line-height:18px;clear:both; }
      .bl-profile-ip::after { font-size:14px;font-weight:600;line-height:22px;
        color:#fff;background:rgba(0,0,0,.7);padding:1px 8px;border-radius:5px;
        margin-left:10px;vertical-align:middle;flex-shrink:0; }
    `;
    (document.head || document.documentElement).append(style);
  }
  function resetCardLayout(anchor) {
    anchor.classList.remove('bl-card-owner','bl-aicu-reserve'); anchor.style.removeProperty('--bl-ip-space');
  }
  function clearAccountLabel(anchor) {
    const target = cardLabelTargets.get(anchor);
    if (target && target !== anchor) { cardLabelTargets.delete(anchor); clearAccountLabel(target); }
    const record = accountLabels.get(anchor);
    if (!record) return;
    anchor.removeAttribute('data-bl-account-label'); anchor.classList.remove('bl-account-label', 'bl-sidebar-ip', 'bl-profile-ip');
    if (anchor.getAttribute('title') === record.appliedTitle) {
      if (record.originalTitle === null) anchor.removeAttribute('title');
      else anchor.setAttribute('title', record.originalTitle);
    }
    resetCardLayout(anchor); accountLabels.delete(anchor);
  }
  function paintAccountLabel(anchor, uid, value, title, card) {
    cardLayoutStyle();
    let record = accountLabels.get(anchor);
    if (!record) { record = { originalTitle: anchor.getAttribute('title') }; accountLabels.set(anchor, record); }
    record.uid = uid;
    const text = 'IP：' + value;
    if (anchor.getAttribute('data-bl-account-label') !== text) anchor.setAttribute('data-bl-account-label', text);
    anchor.classList.add('bl-account-label');
    record.appliedTitle = [record.originalTitle, title].filter(Boolean).join('\n');
    if (anchor.title !== record.appliedTitle) anchor.title = record.appliedTitle;
    if (card) {
      anchor.classList.add('bl-card-owner');
      // Reserve room using text length, without inserting a measurement or label node.
      const width = [...text].reduce((n, c) => n + (c.charCodeAt(0) < 128 ? 7 : 12), 8);
      const reserve = 'calc(min(42%, ' + width + 'px) + 8px)';
      if (anchor.style.getPropertyValue('--bl-ip-space') !== reserve) anchor.style.setProperty('--bl-ip-space', reserve);
    }
  }
  function decorateCard(anchor, uid, value, title) {
    const sidebar = anchor.closest('.video-page-card-small,.video-card-reco');
    const target = sidebar && (sidebar.querySelector('.info') || anchor.parentElement);
    if (target && target !== anchor) {
      const previous = cardLabelTargets.get(anchor);
      if (previous && previous !== target) clearAccountLabel(previous);
      cardLabelTargets.set(anchor, target);
      paintAccountLabel(target, uid, value, title, false);
      target.classList.add('bl-sidebar-ip');
    } else paintAccountLabel(anchor, uid, value, title, true);
  }
  function props(el) {
    const result = [];
    try {
      let vm = el.__vueParentComponent || el.__vue__?.$ || el.__vue__;
      for (let i = 0; vm && i < 4; i++, vm = vm.parent) {
        for (const p of [vm.props, vm.vnode?.props, vm.$props, vm._props]) if (p) result.push(p);
      }
    } catch {}
    return result;
  }
  function replyData(el) {
    if (el.data?.reply_control) return el.data;
    for (const p of props(el)) for (const key of ['reply', 'subReply', 'item', 'data']) {
      if (p[key]?.reply_control) return p[key];
    }
    return null;
  }
  function renderReply(el) {
    try {
      const data = replyData(el);
      const rid = id(data?.rpid_str) || id(data?.rpid) || id(el.getAttribute('data-rpid')) || id(el.getAttribute('data-id'));
      const value = clean(data?.reply_control?.location) || replies.get(rid) || '';
      const scope = el.shadowRoot || el;
      const anchor = scope.querySelector('#pubdate,.sub-reply-time,.reply-time,.reply-info .time,.info .time,.time');
      if (anchor) decorate(anchor, 'comment', value, '这条评论的数据所附属地；不代表用户当前属地');
    } catch {}
  }
  const uidFrom = el => { try { return new URL(el.href, location.href).hostname === 'space.bilibili.com' ?
    new URL(el.href, location.href).pathname.match(/^\/(\d+)/)?.[1] || '' : ''; } catch { return ''; } };
  function account(anchor, uid, wanted = () => true, card = false, allowQuery = true, waitingReason = '') {
    if (!anchor || !uid) return;
    if (accountLabels.get(cardLabelTargets.get(anchor) || anchor)?.uid !== uid) clearAccountLabel(anchor);
    const value = cache[uid];
    let label, title;
    const cached = value && Date.now() - value.time < (value.location ? DAY : 30 * 60000);
    if (cached) {
      label = value.location || '未知';
      title = value.location ? 'B 站账号属地；查询于 ' + new Date(value.time).toLocaleString() :
        '查询成功，但接口未提供账号属地；不能据此判断是否封禁或长期未登录。查询于 ' + new Date(value.time).toLocaleString();
    } else if (!token) {
      label = '未授权'; title = '账号属地需要客户端授权；可打开右下角 IP 属地面板操作';
    } else if (Date.now() < (failures.get(uid) || 0)) {
      label = '无法获取'; title = failureReasons.get(uid) || '本次查询失败，稍后重试；未取得具体账号原因';
    } else if (Date.now() < pausedUntil) {
      label = '暂缓查询'; title = '接口查询暂停中；请稍后再试，不代表该账号没有属地';
    } else {
      label = pending.has(uid) ? '查询中' : '待查询';
      title = waitingReason || '等待查询账号属地；不代表该账号没有属地';
    }
    if (card) decorateCard(anchor, uid, label, title);
    else paintAccountLabel(anchor, uid, label, title, false);
    if (!cached && allowQuery) lookup(uid, wanted);
  }
  function visible(anchor) {
    if (!anchor.isConnected || document.hidden) return false;
    if (typeof IntersectionObserver === 'function') return visibleCards.has(anchor);
    const r = anchor.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
  }
  const cardObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) visibleCards.add(entry.target); else visibleCards.delete(entry.target);
    }
    schedule();
  }) : null;
  function cardUID(card) {
    for (const a of card.querySelectorAll('a[href*="space.bilibili.com/"]')) {
      const uid = uidFrom(a); if (uid) return uid;
    }
    for (const p of props(card)) for (const key of ['info', 'item', 'data', 'video', 'videoData']) {
      const v = p[key];
      const uid = id(v?.owner?.mid) || ((v?.bvid || v?.aid) ? id(v?.mid) : '');
      if (uid) return uid;
    }
    const href = card.querySelector('a[href*="/video/"]')?.getAttribute('href') || '';
    const video = href.match(/\/video\/(BV[a-zA-Z0-9]+|av\d+)/)?.[1];
    return videos.get(video?.startsWith('av') ? video.slice(2) : video) || '';
  }
  function renderCards(root) {
    for (const [el] of cardAnchors) if (!el.isConnected) { clearAccountLabel(el); cardObserver?.unobserve(el); cardObserved.delete(el); cardAnchors.delete(el); }
    for (const card of root.querySelectorAll('.bili-video-card,.video-page-card-small,.video-card,.video-card-reco,.bili-video-card__wrap')) {
      try {
        const anchor = card.querySelector('.bili-video-card__info--owner,.upname,.up-name,.up,.author');
        if (!anchor) continue;
        const uid = cardUID(card);
        if (!uid) continue;
        cardAnchors.set(anchor, uid);
        if (cardObserver && !cardObserved.has(anchor)) { cardObserved.add(anchor); cardObserver.observe(anchor); }
        if (accountLabels.get(cardLabelTargets.get(anchor) || anchor)?.uid !== uid) clearAccountLabel(anchor);
        if (!cardEnabled) { clearAccountLabel(anchor); continue; }
        if (!visible(anchor)) continue;
        const value = cache[uid];
        const overBudget = !reservedCards.has(uid) && reservedCards.size >= cardLimit;
        account(anchor, uid, () => true, true, false, overBudget ? '本页额外查询额度已用完，可在面板追加；尚未查询该账号' : '');
        if (value && Date.now() - value.time < (value.location ? DAY : 30 * 60000)) continue;
        if (!token || Date.now() < pausedUntil || Date.now() < (failures.get(uid) || 0) ||
            (value && Date.now() - value.time < 30 * 60000)) continue;
        if (!reservedCards.has(uid)) {
          if (reservedCards.size >= cardLimit) continue;
          reservedCards.add(uid);
        }
        account(anchor, uid, () => cardEnabled && cardAnchors.get(anchor) === uid && visible(anchor), true);
      } catch {}
    }
  }
  function renderAccounts(root) {
    const spaceUid = location.hostname === 'space.bilibili.com' ? location.pathname.match(/^\/(\d+)/)?.[1] :
      location.hostname === 'm.bilibili.com' ? location.pathname.match(/^\/space\/(\d+)/)?.[1] : '';
    if (spaceUid) {
      // Pick the whole name/level row once, never both the row and its name child.
      const row = root.querySelector('.upinfo-detail__top') || root.querySelector('.h-basic > div') ||
        root.querySelector('#h-name')?.parentElement || root.querySelector('.space-info .name')?.parentElement ||
        root.querySelector('.space-head .name')?.parentElement;
      if (row) {
        for (const el of accountLabels.keys()) {
          if (el !== row && (el.classList.contains('bl-profile-ip') || row.contains(el) || el.contains(row))) clearAccountLabel(el);
        }
        account(row, spaceUid); row.classList.add('bl-profile-ip');
      }
      return;
    }
    for (const el of root.querySelectorAll('.up-info-container .up-name,.up-info--right .up-name,.up-info .up-name,.up-info a[href*="space.bilibili.com"],.video-up-info a[href*="space.bilibili.com"]')) {
      account(el, uidFrom(el) || uidFrom(el.closest('a') || {}));
    }
  }
  function renderPost(el) {
    let item;
    for (const p of props(el)) for (const key of ['item', 'dyn', 'dynamic', 'data']) {
      if (p[key]?.modules?.module_author) { item = p[key]; break; }
    }
    // No descendant lookup of forwarded original posts: preserve attribution.
    let did = id(item?.id_str) || id(el.getAttribute('data-did')) || id(el.getAttribute('data-id'));
    if (!did) {
      const link = el.querySelector('.bili-dyn-item__time a,.bili-dyn-item__time,.dyn-card-opus__time');
      did = link?.getAttribute('href')?.match(/(?:t\.bilibili\.com\/|\/opus\/)(\d+)/)?.[1] || '';
    }
    if (!did && el.matches('.opus-detail')) did = location.pathname.match(/^\/opus\/(\d+)/)?.[1] || '';
    const value = clean(item?.modules?.module_author?.pub_location_text) || posts.get(did) || '';
    const anchor = el.querySelector('.bili-dyn-item__author,.bili-dyn-title__text,.dyn-card-opus__author,.opus-module-author__name,.dynamic-author .name');
    if (!anchor) return;
    if (value) decorate(anchor, 'post', value, '这条动态发布时的属地');
    else {
      decorate(anchor, 'post', '');
      // Current account location is explicitly labelled; never mislabel it as post-time IP.
      const uid = id(item?.modules?.module_author?.mid) || uidFrom(anchor) ||
        uidFrom(el.querySelector('.bili-dyn-item__author a,.opus-module-author a[href*="space.bilibili.com"]') || {});
      const spaceUid = location.hostname === 'space.bilibili.com' ? location.pathname.match(/^\/(\d+)/)?.[1] : '';
      if (uid && uid === spaceUid) account(anchor, uid);
      else clearAccountLabel(anchor);
    }
    if (value) clearAccountLabel(anchor);
  }
  function observe(root) {
    if (!root || watched.has(root)) return;
    roots.add(root);
    const observer = new MutationObserver(records => {
      if (records.some(r => !r.target.closest?.('.bl-ui,.bl-location') &&
        [...r.addedNodes, ...r.removedNodes].some(n => !n.classList?.contains('bl-location')))) schedule();
    });
    observer.observe(root, { childList: true, subtree: true }); watched.set(root, observer);
  }
  function schedule() { if (!timer) timer = setTimeout(scan, 350); }
  function scan() {
    timer = null; if (!pageReady || scanning || document.hidden) return; scanning = true;
    try {
      for (const anchor of accountLabels.keys()) if (!anchor.isConnected) clearAccountLabel(anchor);
      if (location.href !== lastURL) { lastURL = location.href; reservedCards.clear(); cardLimit = 20; status = token ? '页面已切换' : '账号属地尚未授权'; }
      try {
        if (W.__INITIAL_STATE__ && W.__INITIAL_STATE__ !== lastInitial) {
          lastInitial = W.__INITIAL_STATE__; ingest(lastInitial);
        }
      } catch {}
      observe(document);
      for (const root of roots) {
        if (root.host && !root.host.isConnected) { watched.get(root)?.disconnect(); watched.delete(root); roots.delete(root); continue; }
        for (const el of root.querySelectorAll('bili-comments,bili-comment-list-renderer,bili-comment-thread-renderer,bili-comment-renderer,bili-comment-replies-renderer,bili-comment-reply-renderer,bili-comment-action-buttons-renderer')) {
          try { if (el.shadowRoot) observe(el.shadowRoot); } catch {}
        }
        for (const el of root.querySelectorAll('bili-comment-action-buttons-renderer,.reply-item,.sub-reply-item,.reply-wrap,.comment-item')) renderReply(el);
        for (const el of root.querySelectorAll('.bili-dyn-item,.opus-detail,.dynamic-item,.dyn-card-opus')) renderPost(el);
        renderAccounts(root);
        renderCards(root);
      }
      if (!document.querySelector('#bl-open') && document.body) createUI();
      syncAicuQueries();
    } finally { scanning = false; }
  }
  function createUI() {
    const button = document.createElement('button'); button.id = 'bl-open'; button.className = 'bl-ui';
    button.textContent = 'IP 属地'; button.title = '属地助手设置与状态';
    button.style.cssText = 'position:fixed;right:12px;bottom:80px;z-index:2147483646;border:1px solid #bbb;border-radius:18px;padding:10px 14px;background:#fff;color:#333;font:14px sans-serif;box-shadow:0 2px 8px #0002;cursor:pointer;';
    button.onclick = panel; document.body.append(button);
    if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand('IP 属地：设置与状态', panel);
  }
  function refreshPanel() {
    const el = document.querySelector('#bl-status');
    if (el) el.textContent = `${status}\nAICU 查询按钮：${aicuEnabled ? '开启' : '关闭'}
本页额外请求 ${stats.requests} 次；已收到 JSON 约 ${(stats.bytes / 1024).toFixed(1)} KB（未压缩，不含请求头和重传）；缓存 ${Object.keys(cache).length} 个账号。\n评论标签 ${stats.comments} 次；动态标签 ${stats.posts} 次。\n首页／推荐卡片 IP：${cardEnabled ? '开启' : '暂停'}；本页额外查询额度已分配 ${reservedCards.size}/${cardLimit} 位 UP 主（含排队后跳过的名额）。\n这是新查询额度，不是 IP 标签数量上限。缓存命中不占新额度，评论不受此限；继续滚动不重置额度。\n被动兼容模式：不改写网页请求、组件注册或更新方法。`;
  }
  function panel() {
    document.querySelector('#bl-panel')?.remove();
    const overlay = document.createElement('div'); overlay.id = 'bl-panel'; overlay.className = 'bl-ui';
    overlay.style.cssText = 'position:fixed;inset:0;background:#0008;z-index:2147483647;display:grid;place-items:center;padding:14px;';
    const box = document.createElement('section');
    box.style.cssText = 'box-sizing:border-box;width:min(520px,100%);max-height:85vh;overflow:auto;background:#fff;color:#222;border-radius:16px;padding:22px;font:15px/1.7 sans-serif;box-shadow:0 6px 30px #0005;';
    box.innerHTML = '<h2 style="margin:0 0 10px;font-size:21px">Bili 属地助手</h2><p>IP 附近的“查询”会复制 UID 并打开第三方 AICU 评论页；可用下方开关隐藏按钮，不传登录凭证。<br>短标签统一显示 <b>IP：地区</b>。主页、UP 主与视频卡片显示账号属地；评论／动态优先显示发布时属地，详细来源可查看标签提示。</p><p id="bl-status" style="white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:8px"></p><label style="display:block"><input id="bl-consent" type="checkbox"> 我同意向 B 站申请客户端凭证，用于查询账号属地。凭证保存在脚本管理器中，只发给 B 站。该非官方授权流程可能失效或导致网页重新登录。</label><div id="bl-actions" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px"></div><p style="font-size:12px;color:#666">账号属地缓存 24 小时，未提供属地缓存 30 分钟；请求间隔至少 1.8 秒。首页／推荐仅查询可见卡片，默认每页最多 20 个不同账号；可手动追加名额。历史评论没有属地时不补猜测地区。关闭此脚本可停止所有功能。v' + VERSION + '</p>';
    const actions = box.querySelector('#bl-actions');
    function action(text, fn) { const b = document.createElement('button'); b.textContent = text; b.style.cssText = 'padding:10px 14px;border:1px solid #ccc;background:#f7f7f7;color:#222;border-radius:8px;font-size:14px;cursor:pointer;'; b.onclick = () => fn(b); actions.append(b); }
    action(aicuEnabled ? '关闭 AICU 查询按钮' : '开启 AICU 查询按钮', b => {
      setAicuEnabled(!aicuEnabled);
      b.textContent = aicuEnabled ? '关闭 AICU 查询按钮' : '开启 AICU 查询按钮';
      refreshPanel();
    });
    action(token ? '重新授权' : '授权读取账号属地', authorize);
    action(cardEnabled ? '暂停首页/推荐 IP' : '开启首页/推荐 IP', b => {
      cardEnabled = !cardEnabled; set('cardEnabled', cardEnabled);
      b.textContent = cardEnabled ? '暂停首页/推荐 IP' : '开启首页/推荐 IP';
      if (!cardEnabled) for (const anchor of cardAnchors.keys()) clearAccountLabel(anchor);
      schedule(); refreshPanel();
    });
    action('追加 20 个卡片查询名额', () => { cardLimit += 20; schedule(); refreshPanel(); });
    action('清除授权', () => { token = ''; epoch++; set('accessKey', ''); cache = {}; prune(); failures.clear(); failureReasons.clear();
      for (const anchor of accountLabels.keys()) clearAccountLabel(anchor);
      status = '本机凭证已清除；如需撤销服务端授权，请在 B 站账号设备管理中操作'; refreshPanel(); });
    action('清空缓存', () => { epoch++; cache = {}; prune(); failures.clear(); failureReasons.clear(); status = '缓存已清空'; refreshPanel(); schedule(); });
    action('刷新状态', refreshPanel);
    action('关闭', () => overlay.remove());
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
    overlay.append(box); document.body.append(overlay); refreshPanel();
  }
  try { ingest(W.__INITIAL_STATE__); } catch {}
  observe(document); schedule();
  // Do not change author markup during initial Vue hydration / native resource setup.
  const ready = () => setTimeout(() => { pageReady = true; schedule(); }, 2000);
  if (document.readyState === 'complete') ready();
  else W.addEventListener('load', ready, { once: true });
  // Property-only updates and history navigation; no continuous background polling.
  setInterval(() => { if (!document.hidden) schedule(); }, 3000);
  document.addEventListener('visibilitychange', schedule);
  // User-initiated external links only. Never send Bilibili credentials to AICU.
  const aicuButtons = new Map();
  let aicuEnabled = get('aicuEnabled', true);
  let aicuHost, aicuRoot, aicuFrame = false;
  function removeAicuButton(el, record) {
    record.link.remove(); el.classList.remove('bl-aicu-reserve');
    if (record.comment && el.style.marginRight === '42px') el.style.marginRight = record.originalMarginRight;
  }
  function clearAicuButtons() {
    for (const [el, record] of aicuButtons) removeAicuButton(el, record);
    aicuButtons.clear(); aicuHost?.remove(); aicuHost = undefined; aicuRoot = undefined;
  }
  function setAicuEnabled(enabled) {
    aicuEnabled = Boolean(enabled); set('aicuEnabled', aicuEnabled);
    if (!aicuEnabled) clearAicuButtons(); else schedule();
  }
  function aicuURL(uid) {
    if (typeof uid !== 'string' || !/^\d+$/.test(uid) || uid === '0') return '';
    const url = new URL('https://www.aicu.cc/reply'); url.searchParams.set('uid', uid); return url.href;
  }
  function ensureAicuHost() {
    if (aicuHost?.isConnected) return;
    aicuHost = document.createElement('div'); aicuHost.className = 'bl-ui'; aicuHost.id = 'bl-aicu-links';
    aicuHost.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483600;';
    aicuRoot = aicuHost.attachShadow({mode:'open'});
    const style = document.createElement('style');
    style.textContent = 'a{position:fixed;display:block;box-sizing:border-box;height:20px;padding:0 5px;font:11px/18px system-ui,sans-serif;white-space:nowrap;text-decoration:none;color:#1683ba;background:#f0f8ff;border:1px solid #a6cfe5;border-radius:4px;pointer-events:auto}a:hover,a:focus{background:#dcefff;outline:1px solid #1683ba}';
    aicuRoot.append(style); document.documentElement.append(aicuHost);
  }
  function aicuTextWidth(text, size=12) {
    return [...text].reduce((sum, c) => sum + (c.charCodeAt(0)<128 ? size*.58 : size), 0);
  }
  function syncAicuQueries() {
    if (!aicuEnabled) { clearAicuButtons(); return; }
    if (!pageReady || document.hidden) return;
    const targets = new Map();
    for (const [el, record] of accountLabels) if (el.isConnected) targets.set(el, {uid:record.uid, account:true});
    for (const root of roots) for (const el of root.querySelectorAll('bili-comment-action-buttons-renderer,.reply-item,.sub-reply-item,.reply-wrap,.comment-item')) {
      try {
        const data=replyData(el), uid=id(data?.member?.mid) || id(data?.mid);
        const scope=el.shadowRoot || el;
        const badge=scope.querySelector('.bl-location[data-kind="comment"]');
        if (uid && badge) targets.set(badge,{uid,account:false});
      } catch {}
    }
    for (const [el, record] of aicuButtons) if (!targets.has(el) || targets.get(el).uid!==record.uid) {
      removeAicuButton(el,record);aicuButtons.delete(el);
    }
    for (const [el, target] of targets) {
      if (!aicuURL(target.uid) || typeof el.getBoundingClientRect !== 'function') continue;
      const rect=el.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.bottom<0 || rect.top>window.innerHeight || rect.right<0 || rect.left>window.innerWidth) {
        const old=aicuButtons.get(el);if(old) old.link.style.display='none';continue;
      }
      ensureAicuHost();
      let record=aicuButtons.get(el);
      if (!record) {
        const link=document.createElement('a');link.textContent='查询';link.href=aicuURL(target.uid);
        link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';
        link.title='AICU 查询（第三方）：点击后复制 UID '+target.uid+' 并打开其评论查询页';
        link.setAttribute('aria-label','在 AICU 查询 UID '+target.uid+' 的历史发言');
        link.addEventListener('click',()=>{
          // Do not await clipboard access: allow native new-tab navigation immediately.
          try { GM_setClipboard(target.uid,'text'); } catch {
            try { navigator.clipboard?.writeText(target.uid).catch(()=>{}); } catch {}
          }
        });
        aicuRoot.append(link);record={uid:target.uid,link,comment:!target.account,originalMarginRight:el.style.marginRight || ''};aicuButtons.set(el,record);
      }
      let left=rect.right+4, top=rect.top+(rect.height-20)/2;
      if (target.account) {
        const text=el.getAttribute('data-bl-account-label') || '';
        if (el.classList.contains('bl-sidebar-ip')) {
          left=rect.left+aicuTextWidth(text)+7;top=rect.bottom-20;
        } else if (el.classList.contains('bl-card-owner')) {
          el.classList.add('bl-aicu-reserve');left=rect.right-36;top=rect.top+(rect.height-20)/2;
        } else {
          // DOM Range measures native text only; CSS-generated IP text adds no template nodes.
          try {
            const range=document.createRange();range.selectNodeContents(el);
            const textRect=range.getBoundingClientRect();
            left=textRect.right+aicuTextWidth(text,el.classList.contains('bl-profile-ip')?14:12)+
              (el.classList.contains('bl-profile-ip')?30:10);
          } catch {}
        }
      } else {
        // Reserve space on our own comment badge, not inside native author markup.
        el.style.marginRight='42px';
      }
      record.link.style.display='block';
      record.link.style.left=Math.max(0,Math.min(left,window.innerWidth-40))+'px';
      record.link.style.top=Math.max(0,top)+'px';
    }
    if (document.querySelector('#bl-panel')) for (const record of aicuButtons.values()) record.link.style.display='none';
  }
  function queueAicuLayout() {
    if (!aicuEnabled || aicuFrame) return;aicuFrame=true;
    requestAnimationFrame(()=>{aicuFrame=false;syncAicuQueries();});
  }
  window.addEventListener('scroll',queueAicuLayout,{passive:true,capture:true});
  window.addEventListener('resize',queueAicuLayout,{passive:true});

})();

})();
