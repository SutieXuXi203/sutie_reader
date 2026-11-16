import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { isZipFile, extractImagesFromZip } from './zipHelper';

describe('zipHelper — Xử lý trích xuất ảnh từ file zip', () => {
  it('isZipFile nhận diện đúng định dạng zip', () => {
    assert.equal(isZipFile({ name: 'chapter1.zip' }), true);
    assert.equal(isZipFile({ name: 'chapter1.ZIP' }), true);
    assert.equal(isZipFile({ name: 'archive', type: 'application/zip' }), true);
    assert.equal(isZipFile({ name: 'archive', type: 'application/x-zip-compressed' }), true);
    assert.equal(isZipFile({ name: 'image.png', type: 'image/png' }), false);
    assert.equal(isZipFile({ name: 'document.pdf' }), false);
  });

  it('extractImagesFromZip giải nén, bỏ qua file rác và sắp xếp theo thứ tự tự nhiên', async () => {
    const zip = new JSZip();

    // Thêm các file theo thứ tự lộn xộn
    zip.file('page_10.jpg', 'fake-jpeg-10');
    zip.file('page_1.jpg', 'fake-jpeg-1');
    zip.file('page_2.png', 'fake-png-2');
    
    // File rác và text
    zip.file('readme.txt', 'do not read me');
    zip.file('.DS_Store', 'junk macos');
    zip.file('__MACOSX/._page_1.jpg', 'junk apple double');
    zip.folder('empty_folder');

    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    const zipBlob = new Blob([zipBuffer], { type: 'application/zip' });

    const progressLogs: number[] = [];
    const files = await extractImagesFromZip(zipBlob, (p) => {
      progressLogs.push(p.percent);
    });

    assert.equal(files.length, 3);
    // Kiểm tra thứ tự tự nhiên: page_1.jpg -> page_2.png -> page_10.jpg
    assert.equal(files[0].name, 'page_1.jpg');
    assert.equal(files[0].type, 'image/jpeg');

    assert.equal(files[1].name, 'page_2.png');
    assert.equal(files[1].type, 'image/png');

    assert.equal(files[2].name, 'page_10.jpg');
    assert.equal(files[2].type, 'image/jpeg');

    // Kiểm tra progress
    assert.equal(progressLogs.length, 3);
    assert.equal(progressLogs[progressLogs.length - 1], 100);
  });

  it('extractImagesFromZip xử lý trường hợp trùng tên ở các thư mục con', async () => {
    const zip = new JSZip();
    zip.file('part1/01.jpg', 'part1 image');
    zip.file('part2/01.jpg', 'part2 image');

    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    const zipBlob = new Blob([zipBuffer], { type: 'application/zip' });

    const files = await extractImagesFromZip(zipBlob);
    assert.equal(files.length, 2);
    assert.equal(files[0].name, 'part1_01.jpg');
    assert.equal(files[1].name, 'part2_01.jpg');
  });

  it('extractImagesFromZip ném lỗi khi file zip không có ảnh hợp lệ', async () => {
    const zip = new JSZip();
    zip.file('info.txt', 'only text');

    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    const zipBlob = new Blob([zipBuffer], { type: 'application/zip' });

    await assert.rejects(
      async () => {
        await extractImagesFromZip(zipBlob);
      },
      /Tệp zip không chứa hình ảnh hợp lệ nào/
    );
  });
});

