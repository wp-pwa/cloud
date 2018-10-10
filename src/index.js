const { http, https } = require('follow-redirects');
const { parse } = require('url');
const cors = require('micro-cors')();
const { send, createError } = require('micro');

module.exports = cors(async (req, res) => {
  try {
    const url = req.url.replace('/', '');
    const { protocol, hostname, path } = parse(url);
    if (!protocol || !hostname) throw new Error(`Invalid url: ${url}`);

    res.setHeader('cache-control', 'public, max-age=31536000');
    res.setHeader('link', `<${url}>; rel="canonical"`);
    res.setHeader('Access-Control-Expose-Headers', '*');

    const transport = protocol === 'https:' ? https : http;
    transport
      .get(
        {
          protocol,
          hostname,
          path,
          headers: {
            'user-agent': req.headers['user-agent'],
            host: hostname,
          },
        },
        file => {
          send(res, 200, file);
        },
      )
      .on('response', ({ headers, statusCode }) => {
        res.statusCode = statusCode;
        Object.keys(headers)
          .filter(key => /(content-type|x-wp)/i.test(key))
          .forEach(key => {
            if (
              /content-type/i.test(key) &&
              /(html|json)/i.test(headers[key])
            ) {
              res.setHeader(
                'cache-control',
                'public, max-age=0, s-maxage=180, stale-while-revalidate=31536000, stale-if-error=31536000',
              );
            }
            res.setHeader(key, headers[key]);
          });
      })
      .on('error', error => {
        throw error;
      });
  } catch (error) {
    throw createError(error.statusCode || 500, error.statusMessage || error);
  }
});
