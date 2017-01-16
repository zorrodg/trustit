const fetch = require('node-fetch');
const cheerio = require('cheerio');
const firebaseAdmin = require('firebase-admin');
const logger = require('debug')('trustit');
const { join } = require('path');

const SOURCES = {
  'https://en.wikipedia.org/wiki/List_of_satirical_news_websites': ($) => {
    const $arr = $('.wikitable .external')
      .map(function () {
        return $(this).attr('href');
      });

    return Promise.resolve(Array.from($arr));
  },
  'https://docs.google.com/document/d/10eA5-mCZLSS4MQY5QGb5ewC3VAL6pLkT53V_81ZyitM/preview': ($) => {
    const $arr = $('script').filter(function () {
      return /^DOCS_modelChunk = \[\{"ty":"is","s":"\\nCurrent count:/.test($(this).text());
    });

    const mapped = Array.from($arr)
      .map(el => {
        data = el.children[0].data

        const match = /\[(.*)\]/.exec(data);
        const dataStr = JSON.parse(match[0])[0].s;
        const urls = dataStr.split('\n\u001c\n\u001c\n\u0012\u001c')
          .filter(str => /(bias|unreliable|fake|unknown|clickbait|junksci)/.test(str))
          .map((str, idx) => idx > 0 ? str.replace(/\s.*/g, '') : str);

        urls[0] = urls[0].split('\u0012\u001c').pop().replace(/\s.*/g, '');

        return urls;
      });
    return Promise.resolve(mapped[0]);
  },
  'http://fakenewswatch.com/': ($) => {
    const $arr = $('li')
      .map(function () {
        return $(this).text();
      });

    return Promise.resolve(Array.from($arr).filter(url => /\.[a-z]{2,3}$/.test(url)));
  }
}

module.exports = function () {
  const promises = Object.keys(SOURCES)
    .map(url => fetch(url)
        .then(res => res.text())
        .then(res => SOURCES[url](cheerio.load(res)))
      );

  let serviceAccountKey, databaseURL, uid;

  try {
    serviceAccount = require(join(__dirname, '..', '.env', 'service-account-key.json'));
    databaseURL = require(join(__dirname, '..', 'package.json')).config.databaseURL;
    uid = require(join(process.cwd(), 'package.json')).config.uid;
  } catch (err) {
    return logger('No service account key. Skipping DB update.', err);
  }

  return Promise.all(promises)
    .then(results => {
      const sites = results.reduce((arr, next) => arr.concat(next), [])
        .map(url => url.toLowerCase()
          .replace(/^https?:\/\//, '')
          .replace(/\/$/, '')
        )
        .reduce((arr, next) => {
          if (arr.indexOf(next) < 0) {
            arr.push(next);
          }

          return arr;
        }, []);

      logger('Updating Database with sites urls...');

      const app = firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(serviceAccount),
        databaseAuthVariableOverride: { uid },
        databaseURL,
      });

      const db = app.database();
      const ref = db.ref("/fake-news-sites");

      ref.set({
        lastUpdated: new Date().toISOString(),
        sites
      }).then(res => {
        logger('Database Updated. Deleting connection...');
        app.delete();
      });
    })
}
