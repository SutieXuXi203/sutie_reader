import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchDirectDriveImageBuffer } from './driveDirect';

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const VALID_PNG = Buffer.concat([PNG_HEADER, Buffer.alloc(20, 1)]);

describe('Google Drive Direct Fallback', () => {
  it('cứu nguy thành công khi upstream gặp sự cố mạng hoặc timeout', async () => {
    const mockDrive = {
      files: {
        get: async () => ({
          data: VALID_PNG,
          headers: {},
        }),
      },
    };

    const result = await fetchDirectDriveImageBuffer('RESCUE_FILE_12345', {
      driveInstance: mockDrive,
    });

    assert.ok(result);
    assert.equal(result.upstreamType, 'image/png');
    assert.equal(result.rawBuffer.length, VALID_PNG.length);
  });
});
