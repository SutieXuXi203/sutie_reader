import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDirectDriveConfigured, fetchDirectDriveImageBuffer } from './driveDirect';

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const VALID_PNG = Buffer.concat([PNG_HEADER, Buffer.alloc(20, 1)]);

describe('isDirectDriveConfigured', () => {
  it('kiểm tra đúng trạng thái cấu hình biến môi trường', () => {
    const originalEnv = { ...process.env };
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REFRESH_TOKEN;
    assert.equal(isDirectDriveConfigured(), false);

    process.env.GOOGLE_CLIENT_ID = 'id';
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
    process.env.GOOGLE_REFRESH_TOKEN = 'refresh';
    assert.equal(isDirectDriveConfigured(), true);

    process.env = originalEnv;
  });
});

describe('fetchDirectDriveImageBuffer', () => {
  it('trả null khi không có drive instance hoặc cấu hình', async () => {
    const originalEnv = { ...process.env };
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REFRESH_TOKEN;

    const res = await fetchDirectDriveImageBuffer('anyId');
    assert.equal(res, null);

    process.env = originalEnv;
  });

  it('lấy thành công và nhận diện đúng định dạng ảnh từ drive giả lập', async () => {
    const mockDrive = {
      files: {
        get: async () => ({
          data: VALID_PNG,
          headers: {},
        }),
      },
    };

    const result = await fetchDirectDriveImageBuffer('VALID_FILE', { driveInstance: mockDrive });
    assert.ok(result);
    assert.equal(result.upstreamType, 'image/png');
    assert.equal(result.rawBuffer.length, VALID_PNG.length);
  });

  it('từ chối khi file không phải ảnh hợp lệ (415)', async () => {
    const mockDrive = {
      files: {
        get: async () => ({
          data: Buffer.from('<svg></svg>'),
          headers: {},
        }),
      },
    };

    await assert.rejects(
      fetchDirectDriveImageBuffer('SVG_FILE', { driveInstance: mockDrive }),
      (err: any) => err.status === 415
    );
  });

  it('từ chối khi file vượt quá kích thước cho phép (413)', async () => {
    const mockDrive = {
      files: {
        get: async () => ({
          data: Buffer.concat([PNG_HEADER, Buffer.alloc(100)]),
          headers: {},
        }),
      },
    };

    await assert.rejects(
      fetchDirectDriveImageBuffer('BIG_FILE', { driveInstance: mockDrive, maxBytes: 50 }),
      (err: any) => err.status === 413
    );
  });

  it('báo lỗi 404 khi file không tồn tại trên Drive', async () => {
    const mockDrive = {
      files: {
        get: async () => {
          const err: any = new Error('File not found');
          err.status = 404;
          throw err;
        },
      },
    };

    await assert.rejects(
      fetchDirectDriveImageBuffer('NONEXISTENT_FILE', { driveInstance: mockDrive }),
      (err: any) => err.status === 404
    );
  });

  it('trả null khi lỗi mạng hoặc lỗi không xác định để route tiếp tục xử lý', async () => {
    const mockDrive = {
      files: {
        get: async () => {
          throw new Error('Connection reset');
        },
      },
    };

    const res = await fetchDirectDriveImageBuffer('ERROR_FILE', { driveInstance: mockDrive });
    assert.equal(res, null);
  });
});
