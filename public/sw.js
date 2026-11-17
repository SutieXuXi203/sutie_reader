// Sutie Reader - Client-Side Image Cache Service Worker
// Lưu trữ vĩnh viễn ảnh truyện trên máy người đọc (0đ, hoạt động offline, tốc độ 0ms)

const CACHE_NAME = 'sutie-reader-images-v1';
const MAX_IMAGE_ENTRIES = 800; // Giữ tối đa 800 ảnh truyện gần nhất trên máy

self.addEventListener('install', (event) => {
  // Kích hoạt ngay lập tức mà không cần chờ người dùng đóng tab
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Giành quyền kiểm soát ngay lập tức cho các tab đang mở
      await self.clients.claim();

      // Dọn dẹp các phiên bản cache cũ nếu có
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith('sutie-reader-images-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })()
  );
});

// Giới hạn dung lượng theo LRU: Xóa bớt ảnh cũ nhất khi số lượng vượt quá giới hạn
async function trimCache(cache, maxEntries) {
  try {
    const keys = await cache.keys();
    if (keys.length > maxEntries) {
      const deleteCount = keys.length - maxEntries;
      for (let i = 0; i < deleteCount; i++) {
        await cache.delete(keys[i]);
      }
    }
  } catch {
    // Bỏ qua lỗi dọn dẹp cache
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Chỉ xử lý các yêu cầu GET tải ảnh truyện qua API
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/image/')) return;

  // Nếu người dùng cố ý bấm nút Thử lại (retry có param ?t=...), lấy trực tiếp từ mạng
  if (url.searchParams.has('t')) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // 1. Kiểm tra xem ảnh đã được lưu trong máy người đọc chưa (Cache-First)
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. Nếu chưa có trên máy, tải từ server về
      try {
        const networkResponse = await fetch(request);

        // Chỉ lưu vào cache khi tải thành công (200 OK) và là dữ liệu ảnh
        // Tuyệt đối không lưu các mã lỗi (401, 403, 404, 500, 502)
        if (
          networkResponse.ok &&
          networkResponse.status === 200 &&
          (networkResponse.headers.get('content-type') || '').includes('image')
        ) {
          await cache.put(request, networkResponse.clone());
          void trimCache(cache, MAX_IMAGE_ENTRIES);
        }

        return networkResponse;
      } catch (fetchError) {
        // 3. Nếu mất mạng hoặc mạng lỗi, thử tra cứu lại trong cache một lần nữa
        const fallback = await cache.match(request);
        if (fallback) {
          return fallback;
        }
        throw fetchError;
      }
    })()
  );
});
