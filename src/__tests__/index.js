const micro = require('micro');
const nock = require('nock');
const listen = require('test-listen');
const got = require('got');
const server = require('../');

let url = null;
let service = null;

beforeEach(async () => {
  jest.spyOn(got, 'get');
  service = micro(server);
  url = await listen(service);
});

afterEach(() => {
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
  expect(got.get.mock.calls[1][1].headers['user-agent']).toBe(
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
  expect(got.get.mock.calls[1][1].headers.host).toBe('fake-domain.com');
});

test('Should send cache-control header', async () => {
  nock('http://fake-domain.com')
    .get('/')
    .reply(200, { result: 'ok' });
  const res = await got(`${url}/http://fake-domain.com/`);
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

test('Should send any x-wp header', async () => {
  const apiResponse = { result: 'ok' };
  nock('http://fake-domain.com')
    .get('/api')
    .reply(200, apiResponse, {
      'x-wp-custom': 'value',
    });
  const { headers } = await got(`${url}/http://fake-domain.com/api`, {
    json: true,
  });
  expect(headers['x-wp-custom']).toEqual('value');
});
