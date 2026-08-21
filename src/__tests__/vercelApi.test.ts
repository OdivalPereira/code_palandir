import { describe, it, expect, vi } from 'vitest';
// @ts-ignore
import handler from '../../api/index.js';

describe('Vercel API Serverless Handler', () => {
  it('should handle CORS preflight OPTIONS request', async () => {
    const req = {
      method: 'OPTIONS',
      url: '/api/session',
      headers: {
        origin: 'https://code-palandir.vercel.app'
      }
    };
    const setHeaderMock = vi.fn();
    const writeHeadMock = vi.fn();
    const endMock = vi.fn();

    const res = {
      setHeader: setHeaderMock,
      writeHead: writeHeadMock,
      end: endMock
    };

    await handler(req as any, res as any);

    expect(setHeaderMock).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://code-palandir.vercel.app');
    expect(setHeaderMock).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
    expect(writeHeadMock).toHaveBeenCalledWith(204);
    expect(endMock).toHaveBeenCalled();
  });
});
