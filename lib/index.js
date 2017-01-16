const { parse } = require('url');
const { join } = require('path');
const fetch = require('node-fetch');
const pkg = require(join(__dirname, '..', 'package.json'));
const updateFakeNewsSites = require('./update-fake-news-sites');

module.exports = function ({
  url
} = {}) {
  url = parse(url, true, true);

  if (!url.host) {
    throw new Error('URL is not valid');
  }

  // Step 1: Check if site is part of the fake news site list
  fetch(pkg.config.databaseURL + '/fake-news-sites.json')
    .then(res => res.json())
    .then(res => {
      // TODO: Continue here!
      console.log(res.sites);
      // TODO: Update fake news daily
      updateFakeNewsSites();
    });


};
