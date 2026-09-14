const mongoose = require('mongoose');
require('dotenv').config();

async function seedRoles() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Missing MONGODB_URI');
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const rolesCollection = mongoose.connection.db.collection('roles');

  const defaultRoles = [
    {
      name: 'admin',
      displayName: 'Quản trị viên',
      description: 'Toàn quyền quản trị hệ thống, bài viết, người dùng và mã PIN bảo mật',
      isDefault: false,
      updatedAt: new Date()
    },
    {
      name: 'user',
      displayName: 'Thành viên',
      description: 'Thành viên chính thức, truy cập toàn bộ items và các chương truyện',
      isDefault: false,
      updatedAt: new Date()
    },
    {
      name: 'guest',
      displayName: 'Khách',
      description: 'Khách có tài khoản, xem các nội dung công khai hoặc được cấp quyền qua email',
      isDefault: true,
      updatedAt: new Date()
    }
  ];

  for (const role of defaultRoles) {
    await rolesCollection.updateOne(
      { name: role.name },
      { 
        $set: role,
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );
  }

  const allRoles = await rolesCollection.find().toArray();
  console.log('Seeded roles successfully:', allRoles.map(r => ({ name: r.name, displayName: r.displayName, isDefault: r.isDefault })));
  process.exit(0);
}

seedRoles().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
