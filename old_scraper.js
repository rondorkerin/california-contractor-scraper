var scraperjs = require('scraperjs');
const Promise = require('bluebird');

let currentSearch = 'a';
let currentName = '';
let currentLicenseNum = '';
let error = false;

let datastore = [];

function scrapeLicenseSearch(licenseNumber) {
  let url = `https://www2.cslb.ca.gov/onlineservices/CheckLicenseII/LicenseDetail.aspx?LicNum=${licenseNumber}`;
  return scraperjs.StaticScraper.create()
  .request({url: url, headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.101 Safari/537.36'}})
  .scrape(function($) {
    return $("#ctl00_LeftColumnMiddle_BusInfo").text();
    /*map(function() {
      return $(this).text();
    }).get();
    */
  })
  .then(function(results) {
    /*
     *
     * > results
        '(813) 695-1892'
        > results.match(/\(\d+\) \d+-\d+/);
        [ '(813) 695-1892', index: 0, input: '(813) 695-1892' ]
     *
     */
    let phoneMatch = results.match(/\(\d+\) \d+-\d+/);
    return {
      phoneNumber: phoneMatch[0]
    }
  })
}

function scrapeNameSearch(currentSearch) {
  let data = [];
  if (currentName) {
    currentSearch = currentName;
  }
  currentSearch = encodeURIComponent(currentSearch);
  let url = `https://www2.cslb.ca.gov/onlineservices/CheckLicenseII/NameSearch.aspx?NextName=${currentSearch}&NextLicNum=${currentLicenseNum}`
  console.log('scraping url', url);
  return scraperjs.StaticScraper.create()
  .request({url: url, headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.101 Safari/537.36'}})
  .scrape(function($) {
    return $("#ctl00_LeftColumnMiddle_Table1 tr td").map(function() {
      return $(this).text();
    }).get();
  })
  .then(function(results) {
    if (results.length == 0) {
      console.log('error', results);
      error = true;
      return [];
    }
    for (let index = 0; (index + 11 < results.length); index += 11) {
      let crntStatus = results[index+10];
      currentName = results[index+2];
      currentLicenseNum = results[index+6].trim();
      if (crntStatus == 'Active') {
        data.push({name: results[index+2], license: results[index+6].trim()});
      }
    }
    return data;
  })
}

var scrapePage = function(search) {
  return scrapeNameSearch(search).then((data) => {
    datastore = datastore.concat(data);
  });
}

var lookupNumbers = function() {
    /*
    return Promise.map(data, (row) => {
      return scrapeLicenseSearch(row.license).then((details) => {
        row.phoneNumber = details.phoneNumber;
        console.log(row);
        datastore.push(row);
        return row;
      });
    })
    */
}

var scrapeSearch = function(search) {
  return scrapePage(search).then(() => {
    if (!error) {
      return scrapePage(search);
    } else {
      error = false;
      return true;
    }
  })
}

scrapeSearch(currentSearch).then((result) => {
  console.log(datastore);
})
