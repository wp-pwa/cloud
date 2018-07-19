/* eslint-disable no-underscore-dangle */
const { parse } = require('url');
const got = require('got');

module.exports = async req => {
  const url = parse(req.url.replace('/', ''));
  if (/favicon/.test(url.href)) return '';
  const response = await got(url, {
    headers: {
      'user-agent': req.headers['user-agent'],
      host: url.host,
    },
  });
  console.log(response.req._header);
  return response.body;
};
