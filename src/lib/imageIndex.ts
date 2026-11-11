import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { collectImageIds } from '@/lib/imageIds';
import type { AnyBulkWriteOperation, Document } from 'mongodb';

/**
 * Điền `imageIds` cho các bài chưa có trường này (dữ liệu cũ, hoặc bài ghi bởi phiên bản mã cũ trong lúc triển khai cuốn chiếu).
 *
 * Route ảnh chỉ được bỏ `$regex` quét collection khi trạng thái là 'ready'. Truy vấn `{ imageIds: { $exists: false } }` dùng được
 * multikey index nên rất rẻ khi không còn bài nào thiếu; vẫn được chạy lại định kỳ để bắt các bài do instance cũ ghi.
 */
type IndexState = {
  status: 'idle' | 'running' | 'ready' | 'failed';
  checkedAt: number;
  retryAt: number;
};

const RECHECK_INTERVAL_MS = 10 * 60 * 1000;
const RETRY_DELAY_MS = 60 * 1000;
const BATCH_SIZE = 200;

const globalWithState = globalThis as typeof globalThis & { sutieImageIndexState?: IndexState };
const state: IndexState = globalWithState.sutieImageIndexState ?? { status: 'idle', checkedAt: 0, retryAt: 0 };
globalWithState.sutieImageIndexState = state;

type BackfillDoc = { _id: unknown; images?: unknown; chapters?: unknown };

export async function backfillImageIds(): Promise<number> {
  await connectDB();
  const collection = Post.collection;
  const cursor = collection.find(
    { imageIds: { $exists: false } },
    { projection: { images: 1, 'chapters.images': 1 } }
  );

  let updated = 0;
  let ops: AnyBulkWriteOperation<Document>[] = [];
  const flush = async () => {
    if (ops.length === 0) return;
    await collection.bulkWrite(ops, { ordered: false });
    updated += ops.length;
    ops = [];
  };

  for await (const doc of cursor as AsyncIterable<BackfillDoc>) {
    ops.push({
      updateOne: {
        // Điều kiện `$exists: false` giữ cho thao tác idempotent và không ghi đè giá trị do route khác vừa đặt
        filter: { _id: doc._id as never, imageIds: { $exists: false } },
        update: { $set: { imageIds: collectImageIds(doc.images, doc.chapters) } },
      },
    });
    if (ops.length >= BATCH_SIZE) await flush();
  }
  await flush();
  return updated;
}

function start() {
  state.status = 'running';
  backfillImageIds()
    .then((count) => {
      if (count > 0) console.log(`[image-index] đã điền imageIds cho ${count} bài viết`);
      state.status = 'ready';
      state.checkedAt = Date.now();
    })
    .catch((error) => {
      console.warn('[image-index] không điền được imageIds, tạm dùng tra cứu dự phòng:', error);
      state.status = 'failed';
      state.retryAt = Date.now() + RETRY_DELAY_MS;
    });
}

/**
 * 'ready': mọi bài đều có `imageIds` -> chỉ cần tra bằng index, không cần quét.
 * 'pending': chưa chắc chắn (đang điền hoặc lỗi) -> route ảnh phải dùng tra cứu dự phòng.
 * Hàm này không chờ: tự khởi động (hoặc chạy lại định kỳ) việc điền ở nền.
 */
export function getImageIndexStatus(): 'ready' | 'pending' {
  const now = Date.now();
  if (state.status === 'idle' || (state.status === 'failed' && now >= state.retryAt)) {
    start();
  } else if (state.status === 'ready' && now - state.checkedAt > RECHECK_INTERVAL_MS) {
    // Vẫn coi là ready trong lúc kiểm tra lại (kết quả lần trước còn mới), nhưng chạy lại để bắt bài do instance cũ ghi
    state.checkedAt = now;
    backfillImageIds().catch(() => undefined);
  }
  return state.status === 'ready' ? 'ready' : 'pending';
}

/** Chỉ dùng trong test */
export function resetImageIndexState() {
  state.status = 'idle';
  state.checkedAt = 0;
  state.retryAt = 0;
}
