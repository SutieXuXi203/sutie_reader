import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const migrations = [
  { old: 'posts', new: 'comics' },
  { old: 'tags', new: 'genres' },
  { old: 'deletedaccounts', new: 'deleted_users' },
  { old: 'ratelimits', new: 'api_rate_limits' }
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not found");
  
  console.log("Đang kết nối tới MongoDB...");
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  if (!db) {
    throw new Error("Không thể lấy Database instance");
  }

  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);

  for (const { old: oldName, new: newName } of migrations) {
    if (collectionNames.includes(oldName)) {
      try {
        await db.collection(oldName).rename(newName);
        console.log(`✅ Đã đổi tên collection: "${oldName}" -> "${newName}"`);
      } catch (err: any) {
        console.error(`❌ Lỗi khi đổi tên "${oldName}":`, err.message);
      }
    } else {
      console.log(`⏭️ Bỏ qua: Collection "${oldName}" không tồn tại (có thể đã được đổi tên rồi).`);
    }
  }

  console.log("Hoàn tất Migration!");
  process.exit(0);
}

main().catch(err => {
  console.error("Lỗi script:", err);
  process.exit(1);
});
