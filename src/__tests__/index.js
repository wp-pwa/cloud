const micro = require('micro');
const nock = require('nock');
const listen = require('test-listen');
const got = require('got');
const { http } = require('follow-redirects');
const { promisify } = require('util');
const { readFile } = require('fs');
const server = require('../');

let url = null;
let service = null;

jest.spyOn(http, 'get');

beforeEach(async () => {
  service = micro(server);
  url = await listen(service);
});

afterEach(() => {
  http.get.mockClear();
  service.close();
});

test('Should throw if no url is passed', async () => {
  await expect(got(`${url}/`)).rejects.toThrow();
});

test('Should throw if invalid url is passed', async () => {
  await expect(got(`${url}/no-valid-url`)).rejects.toThrow();
});

test('Should return 500 status if it fails', async () => {
  try {
    await got(`${url}/no-valid-url`);
  } catch (error) {
    expect(error.statusCode).toBe(500);
  }
});

test('Should return 404 status if API returns 404', async () => {
  nock('http://fake-domain.com')
    .get('/')
    .reply(404, 'Not found!');
  try {
    await got(`${url}/http://fake-domain.com/`);
  } catch (error) {
    expect(error.statusCode).toBe(404);
  }
});

test('Should send the same User Agent than what is called with', async () => {
  nock('http://fake-domain.com')
    .get('/')
    .reply(200, { result: 'ok' });
  await got(`${url}/http://fake-domain.com/`, {
    headers: {
      'user-agent': 'My custom User Agent',
    },
  });
  expect(http.get.mock.calls[0][0].headers['user-agent']).toBe(
    'My custom User Agent',
  );
});

test('Should send the same Host than what is called with', async () => {
  nock('http://fake-domain.com')
    .get('/')
    .reply(200, { result: 'ok' });
  await got(`${url}/http://fake-domain.com/`, {
    headers: {
      host: 'fake-domain.com',
    },
  });
  expect(http.get.mock.calls[0][0].headers.host).toBe('fake-domain.com');
});

test('Should send a short cache-control header if json or html', async () => {
  nock('http://fake-domain.com')
    .get('/')
    .reply(200, '<html></html>', { 'Content-Type': 'text/html' });
  const html = await got(`${url}/http://fake-domain.com/`);
  nock('http://fake-domain.com')
    .get('/api')
    .reply(200, { result: 'ok' }, { 'Content-Type': 'application/json' });
  const json = await got(`${url}/http://fake-domain.com/api`);
  expect(html.headers['cache-control']).toBe(json.headers['cache-control']);
  expect(html.headers['cache-control']).toMatchSnapshot();
});

test('Should send a long cache-control header if not json or html', async () => {
  nock('http://fake-domain.com')
    .get('/test-image.png')
    .replyWithFile(200, `${__dirname}/test-image.png`, {
      'Content-Type': 'image/png',
    });
  const res = await got(`${url}/http://fake-domain.com/test-image.png`);
  expect(res.headers['cache-control']).toMatchSnapshot();
});

test('Should send CORS headers', async () => {
  nock('http://fake-domain.com')
    .get('/')
    .reply(200, { result: 'ok' });
  const res = await got(`${url}/http://fake-domain.com/`);
  const headers = Object.keys(res.headers)
    .filter(header => /access-control-allow/.test(header))
    .reduce((obj, key) => ({ ...obj, [key]: res.headers[key] }), {});
  expect(headers).toMatchSnapshot();
});

test('Should send API response', async () => {
  const apiResponse = { result: 'ok' };
  nock('http://fake-domain.com')
    .get('/api')
    .reply(200, apiResponse);
  const { body } = await got(`${url}/http://fake-domain.com/api`, {
    json: true,
  });
  expect(body).toEqual(apiResponse);
});

test('Should send image response', async () => {
  nock('http://fake-domain.com')
    .get('/test-image.png')
    .replyWithFile(200, `${__dirname}/test-image.png`, {
      'Content-Type': 'image/png',
    });
  const res = await got(`${url}/http://fake-domain.com/test-image.png`);
  const buffer = await promisify(readFile)(`${__dirname}/test-image.png`);
  expect(res.body).toEqual(buffer.toString());
});

test('Should send any x-wp header', async () => {
  nock('http://fake-domain.com')
    .get('/api')
    .reply(
      200,
      { result: 'ok' },
      {
        'x-wp-custom': 'value',
      },
    );
  const { headers } = await got(`${url}/http://fake-domain.com/api`);
  expect(headers['x-wp-custom']).toEqual('value');
});

test('Should send a rel canonical header', async () => {
  nock('http://fake-domain.com')
    .get('/api')
    .reply(200, { result: 'ok' });
  const { headers } = await got(`${url}/http://fake-domain.com/api`);
  expect(headers.link).toEqual('<http://fake-domain.com/api>; rel="canonical"');
});

test('Should resolve 301 redirects automatically ', async () => {
  const response = { result: 'ok' };
  nock('http://fake-domain.com')
    .get('/old')
    .reply(301, 'Moved permamently!', {
      location: 'http://fake-domain.com/new',
    });
  nock('http://fake-domain.com')
    .get('/new')
    .reply(200, response);
  const { body } = await got(`${url}/http://fake-domain.com/old`, {
    json: true,
    followRedirect: false,
  });
  expect(body).toEqual(response);
});

test('Should resolve 302 redirects automatically ', async () => {
  const response = { result: 'ok' };
  nock('http://fake-domain.com')
    .get('/old')
    .reply(302, 'Moved temporarily!', {
      location: 'http://fake-domain.com/new',
    });
  nock('http://fake-domain.com')
    .get('/new')
    .reply(200, response);
  const { body } = await got(`${url}/http://fake-domain.com/old`, {
    json: true,
    followRedirect: false,
  });
  expect(body).toEqual(response);
});

test('Should send a custom cache-control header if specified', async () => {
  nock('http://fake-domain.com')
    .get('/api')
    .query({
      'cache-control': {
        's-maxage': 666,
      },
    })
    .reply(200, { result: 'ok' });
  const res = await got(
    `${url}/http://fake-domain.com/api?cache-control[s-maxage]=666`,
  );
  expect(res.headers['cache-control']).toMatchSnapshot();
});
