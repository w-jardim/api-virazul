const requestIdMiddleware = require('../../src/middlewares/request-id');

describe('request-id middleware', () => {
  test('reuses incoming X-Request-Id', () => {
    const req = {
      headers: {
        'x-request-id': 'incoming-id-123',
      },
    };
    const res = {
      setHeader: jest.fn(),
    };
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBe('incoming-id-123');
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', 'incoming-id-123');
    expect(next).toHaveBeenCalled();
  });

  test('generates request id when header is absent', () => {
    const req = { headers: {} };
    const res = {
      setHeader: jest.fn(),
    };
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(typeof req.requestId).toBe('string');
    expect(req.requestId.length).toBeGreaterThan(10);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.requestId);
    expect(next).toHaveBeenCalled();
  });
});
