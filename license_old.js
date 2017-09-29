/*
 * California scraper
 * Outputs a CSV file containing all contractors in california + their contact info
 *
 */


const _ = require('underscore');
const cheerio = require('cheerio')
const request = require('request-promise');
const Promise = require('bluebird');
const fs = require('fs');
const csvWriter = require('csv-write-stream');

// How many pages we search per letter
const DEPTH_OF_SEARCH_PER_LETTER = 500;

// TODO: store the list in SQLITE.
//
const writer = csvWriter()
writer.pipe(fs.createWriteStream('out.csv'))

// TODO: take in a list of valid cities
// TODO: dont do duplicates of the same license #
// currentLicenseNum is null on the first call but used on subsequent calls
// returns a list of contractors with the given name & license number info.
// This function should be called subsequently.
function searchForContractorsByName(name, previousContractors) {
  const encodedName = encodeURIComponent(name);
  const url = `https://www2.cslb.ca.gov/onlineservices/CheckLicenseII/NameSearch.aspx?NextName=${encodedName}`;
  return request({method: 'POST', url: url, headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.101 Safari/537.36',
    'Referrer': 'url',
  }}).then((body) => {
    const $ = cheerio.load(body)
    const contractors = [];
    let nextName = '';
    let hasData = false;
    let count = 0;
    let repeatPage = false;
    $("#ctl00_LeftColumnMiddle_Table1 tr td table tbody").each((index, element) => {
      count++;
      const contractor = {};
      $(element).find('td').each((index, element) => {
        const text = $(element).text().trim();
        const indices = {
          '1': 'name',
          '3': 'type',
          '5': 'license',
          '7': 'city',
          '9': 'status'
        }

        if (indices[index]) {
          contractor[indices[index]] = text;
        }
      });
      nextName = contractor.name;
      if (contractor.status == 'Active') {
        writer.write(contractor);
        contractors.push(contractor);
        hasData = true;
      }
      if (_.findWhere(previousContractors, {license: contractor.license, type: contractor.type, name: contractor.name, city: contractor.city} )) {
        repeatPage = true;
      }
    });

    if (count < 50 || repeatPage) {
      hasData = false;
      console.log('out of data, next');
    }
    return { contractors, nextName, hasData }
  }).catch((e) => {
    console.log('error, going on to the next thing.');
    return Promise.resolve().timeout(60000).then(() => {
      return { contractors: [], nextName: null, hasData: false }
    });
  })
}

// goes down the rabbit hole of all pages with a given letter
// (recursive)
// Stops searching after 10 pages.
function scrapeContractorPageAndContinue(name, contractorList, count) {
  if (count > DEPTH_OF_SEARCH_PER_LETTER) {
    return contractorList;
  }

  // wait 2 seconds between scrapes.
  return Promise.resolve().timeout(2000).then(() => {
    // used for detecting when we're at the end of a cycle
    let previousContractors = contractorList.length > 50 ? contractorList.slice(contractorList.length-50) : [];
    return searchForContractorsByName(name, previousContractors);
  }).then((results) => {
    console.log('page', count, 'name', name, 'number of contractors', results.contractors.length, 'num total', contractorList.length);
    if (!results.hasData) {
      console.log('ran out of data, done this rabbit hole.');
      return contractorList;
    }
    return scrapeContractorPageAndContinue(results.nextName, contractorList.concat(results.contractors), count + 1)
  })
}

function scrapeContractorsWithLetter(letter) {
  return scrapeContractorPageAndContinue(letter, [], 1)
}

var alphabet = "abcdefghijklmnopqrstuvwxyz0123456789".split("");
alphabet = "cdefghijklmnopqrstuvwxyz0123456789".split("");

// used to promise.reduce but now dont because id run out of memory
Promise.each(alphabet, function(letter) {
  return scrapeContractorsWithLetter(letter, [])
}).then(() => {
  console.log('done');
  writer.end();
});
