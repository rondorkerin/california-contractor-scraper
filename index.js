var scraperjs = require('scraperjs');

let currentSearch = 'a';

var nameSearchUrl = function(currentSearch) {
}

var licenseSearchUrl = function(licenseNumber) {
}

const datastore = [];

function scrapeLicenseSearch(licenseNumber) {
  let url = `https://www2.cslb.ca.gov/onlineservices/CheckLicenseII/LicenseDetail.aspx?LicNum=${licenseNumber}`;
  console.log(url);
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
    console.log('results', results);
    let phoneMatch = results.match(/\(\d+\) \d+-\d+/);
    return {
      phoneNumber: phoneMatch[0]
    }
  })
}

function scrapeNameSearch(currentSearch) {
  let url = `https://www2.cslb.ca.gov/onlineservices/CheckLicenseII/NameSearch.aspx?NextName=${currentSearch}&NextLicNum=`
  return scraperjs.StaticScraper.create(url)
  .scrape(function($) {
    return $("#ctl00_LeftColumnMiddle_Table1 tr td").map(function() {
      return $(this).text();
    }).get();
  })
  .then(function(results) {
    for (let index = 0; (index + 11 < results.length); index += 11) {
      let crntStatus = results[index+10];
      if (crntStatus == 'Active') {
        console.log('name', results[index + 2], 'license', results[index+6], 'status', results[index+10]);
        datastore.push({name: results[index+2], license: results[index+6].trim()});
      }
    }
  })
}

scrapeNameSearch(currentSearch).then(() => {
  console.log(datastore);
  let testLicense = datastore[0].license;
  scrapeLicenseSearch(testLicense).then((details) => {
    datastore[0].phoneNumber = details.phoneNumber;
    console.log('scraped number', datastore[0]);
  });
});
