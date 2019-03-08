const axios = require('axios');
const r = require('ramda');

// License

const licenseUrl =
  'http://data.coa.gov.tw/Service/OpenData/FromM/PesticideData.aspx';

function getLicenses() {
  return axios.get(licenseUrl).then(res => res.data);
}

function groupByCodenames(licenses) {
  const codenameKey = '農藥代號';
  let codenameMap = {};
  for (let lic of licenses) {
    if (!codenameMap[lic[codenameKey]]) {
      codenameMap[lic[codenameKey]] = [];
    }
    codenameMap[lic[codenameKey]].push(lic);
  }
  return codenameMap;
}

// Usage

const usageUrlKey = '農藥使用範圍';

let usages = {};
function getUsages(license) {
  const url = license[usageUrlKey];
  if (!usages[url]) {
    usages[url] = axios.get(url).then(res => res.data);
  }
  return usages[url];
}

// Entry

const nameKey = '中文名稱';
const brandKey = '廠牌名稱';

function isEntryEqual(e0, e1) {
  if (
    e0['作物名稱'] === e1['作物名稱'] &&
    e0['病蟲害名稱'] === e1['病蟲害名稱'] &&
    e0['稀釋倍數'] === e1['稀釋倍數']
  ) {
    return true;
  }
  return false;
}

async function createEntry(id, licenses) {
  if (!(licenses && licenses[0])) {
    throw new Error('need licenses to continue');
  }

  const allUsages = await Promise.all(licenses.map(getUsages)).then(r.flatten);
  // dedup
  let usages = [];
  for (let i = 0; i < allUsages.length; ++i) {
    let found = false;
    for (let j = 0; j < usages.length; ++j) {
      found = isEntryEqual(allUsages[i], usages[j]);
      if (found) break;
    }
    if (!found) {
      usages.push(allUsages[i]);
    }
  }

  return {
    id,
    '普通名稱': licenses[0][nameKey],
    '廠牌名稱': licenses[0][brandKey],
    '通過日期': null, // TODO
    licenses,
    usages,
  };
}

module.exports = {
  getLicenses,
  groupByCodenames,
  createEntry,
  entryNameKey: '普通名稱'
};
