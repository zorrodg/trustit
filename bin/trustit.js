const args = process.argv.slice(2);
const params = [
  'url'
].reduce((obj, key, idx) => {
  obj[key] = args[idx];

  return obj;
}, {});

require('./../lib/index.js')(params);
