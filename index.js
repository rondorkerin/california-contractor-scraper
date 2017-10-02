/*
 * California scraper
 * Outputs a CSV file containing all contractors in california + their contact info
 *
 * TODO: keep track of last license and push new ones
 */


const _ = require('underscore');
const cheerio = require('cheerio')
const request = require('request-promise');
const Promise = require('bluebird');
const fs = require('fs');
const csvWriter = require('csv-write-stream');


const MODE = 'historical'; // if mode != historical, assumes theres a spreadsheet containing
                           // the highest license number, reads that number and continues writing.
const HIGHEST_LICENSE_NUMBER = 1031528;
const CURRENT_LICENSE_NUMBER = 1025621;
const LOWEST_LICENSE_NUMBER = 231528;

const writer = csvWriter()
writer.pipe(fs.createWriteStream('out.csv'))

function scrapePersonnel(license, name) {
  const encodedName = name;
  const url = `https://www2.cslb.ca.gov/onlineservices/CheckLicenseII/PersonnelList.aspx?LicNum=${license}&LicName=${name}`;
  return request({method: 'POST', url: url, headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.101 Safari/537.36',
    'Referrer': 'url',
  }}).then((body) => {
    const $ = cheerio.load(body)
    // cheerio returns an iterable object which we turn into an array
    const personnelContent = Array.from($("#ctl00_LeftColumnMiddle_Table1 table tr").children()
      .map(function(i, e) {
        return $(this).text()
      }));
    const personnel = [];
    for (let i = 0; i < personnelContent.length; i++) {
      if (personnelContent[i] == 'Name') {
        personnel.push(personnelContent[i+1].trim());
      }
    }
    return personnel.join(',');
  })
}

function scrapeLicense(license) {
  const encoded = `%09${license}`;
  const url = `https://www2.cslb.ca.gov/onlineservices/CheckLicenseII/LicenseDetail.aspx?LicNum=${encoded}`;
  return request({method: 'POST', url: url, headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.101 Safari/537.36',
    'Referrer': 'url',
  }}).then((body) => {
    const $ = cheerio.load(body)
    let businessInfo = $("#ctl00_LeftColumnMiddle_BusInfo").html().split('<br>');
    if (businessInfo.length == 0) {
      throw 'invalid page';
    }
    let statusInfo = $("#ctl00_LeftColumnMiddle_Status").text();
    const contractor = {
      license,
      status: statusInfo == 'This license is current and active.All information below should be reviewed.' ? 'active' : 'inactive'
    }
    debugger;
    for (let i = 0; i < businessInfo.length; i++) {
      if (businessInfo[i].indexOf(',') !== -1) {
        contractor.city = businessInfo[i].split(',')[0]
        contractor.zip = businessInfo[i].match(/\d+/)[0]
      }
      if (businessInfo[i].indexOf(':') !== -1) {
        contractor.phone = businessInfo[i].split(':')[1]
      }
    }
    contractor.name = businessInfo[0];
    return scrapePersonnel(license, contractor.name).then((personnel) => {
      console.log('writing', license);
      contractor.personnel = personnel;
      writer.write(contractor);
      return contractor;
    });
  })
}

function historicalScrape(number) {
  if (!number) { number = CURRENT_LICENSE_NUMBER; }
  if (number <= LOWEST_LICENSE_NUMBER) { console.log('done'); return; }
  return scrapeLicense(number).then((res) => {
    return Promise.resolve().timeout(1000).then(() => {
      return historicalScrape(number - 1);
    })
  }).catch((e) => {
    console.log('got an error');
    return Promise.resolve().timeout(30000).then(() => {
      return historicalScrape(number - 1);
    })
  });

}
if (MODE == 'historical') {
  historicalScrape();
} else {

}

