import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Post } from '../src/models/Post';
import { Tag } from '../src/models/Tag';

dotenv.config();

const mockComics = [
  {
    title: "Xin mời thưởng thức món chính♪",
    author: "Otyatora_R",
    translator: "Sutie Team",
    tags: ["Romance", "Slice of Life", "Comedy"],
    description: "Một câu chuyện ngọt ngào về tình yêu và những món ăn ngon được chuẩn bị với trọn vẹn trái tim.",
    image: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80",
    chapters: [
      { title: "Chương 1: Món khai vị", chapterNumber: 1, content: "Hôm nay tiệm mở cửa đón vị khách đặc biệt đầu tiên.", images: [] },
      { title: "Chương 2: Gia vị bí mật", chapterNumber: 2, content: "Món súp kem nấm ấm áp sưởi ấm trái tim.", images: [] },
    ],
  },
  {
    title: "Thợ Săn Bóng Đêm",
    author: "Chugong",
    translator: "Bạch Nguyệt Quang",
    tags: ["Action", "Fantasy", "Supernatural"],
    description: "Khi cánh cổng liên kết thế giới thực và ngục tối mở ra, một thợ săn cấp thấp thức tỉnh sức mạnh vô hạn.",
    image: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80",
    chapters: [
      { title: "Chương 1: Cánh cổng thức tỉnh", chapterNumber: 1, content: "Một ngày định mệnh tại hầm ngục cấp E.", images: [] },
      { title: "Chương 2: Sức mạnh bóng tối", chapterNumber: 2, content: "Sự trỗi dậy của vị vua bóng đêm bất tử.", images: [] },
      { title: "Chương 3: Nhiệm vụ đầu tiên", chapterNumber: 3, content: "Thử thách sinh tồn nơi hoang dã.", images: [] },
    ],
  },
  {
    title: "Tiệm Trà Dưới Ánh Trăng",
    author: "Midorikawa Yuki",
    translator: "", // Test không có dịch giả
    tags: ["Slice of Life", "Supernatural", "Drama"],
    description: "Một góc phố nhỏ yên bình nơi những linh hồn lạc lối tìm về để thưởng thức tách trà thanh khiết.",
    image: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&auto=format&fit=crop&q=80",
    chapters: [
      { title: "Chương 1: Trà hoa cúc", chapterNumber: 1, content: "Hương trà thoang thoảng xua tan mệt mỏi.", images: [] },
    ],
  },
  {
    title: "Khu Rừng Đom Đóm Lấp Lánh",
    author: "Inoue Takehiko",
    translator: "Mèo Cam Sub",
    tags: ["Drama", "Romance", "School Life"],
    description: "Mùa hè năm ấy, tiếng ve râm ran và cuộc gặp gỡ định mệnh đã thay đổi hoàn toàn cuộc đời của hai đứa trẻ.",
    image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80",
    chapters: [
      { title: "Chương 1: Mùa hạ đầu tiên", chapterNumber: 1, content: "Cơn mưa rào bất chợt cuốn trôi muộn phiền.", images: [] },
      { title: "Chương 2: Chiếc mặt nạ cáo", chapterNumber: 2, content: "Bí mật được giấu kín sau lớp mặt nạ gỗ.", images: [] },
    ],
  },
  {
    title: "Học Viện Thần Tượng Âm Nhạc",
    author: "Aka Akasaka",
    translator: "Hội Người Lười",
    tags: ["Comedy", "School Life", "Music"],
    description: "Hành trình vươn tới sân khấu rực rỡ của những cô gái trẻ đầy nhiệt huyết và đam mê âm nhạc.",
    image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80",
    chapters: [
      { title: "Chương 1: Buổi thử giọng", chapterNumber: 1, content: "Những nốt nhạc rung động cảm xúc người nghe.", images: [] },
    ],
  },
  {
    title: "Đại Chiến Thiên Hà: Tinh Cầu Lạc Lối",
    author: "Yukimura Makoto",
    translator: "Aowu Scan",
    tags: ["Sci-Fi", "Action", "Adventure"],
    description: "Cuộc phiêu lưu thám hiểm ngoài không gian sâu thẳm để tìm kiếm nguồn năng lượng cứu vãn nhân loại.",
    image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80",
    chapters: [
      { title: "Chương 1: Phi thuyền khởi hành", chapterNumber: 1, content: "Rời khỏi quỹ đạo Trái Đất hướng về vô định.", images: [] },
      { title: "Chương 2: Vùng tinh vân đen", chapterNumber: 2, content: "Tín hiệu cầu cứu bí ẩn từ hành tinh lạ.", images: [] },
    ],
  },
  {
    title: "Ký Ức Mùa Thu Vàng",
    author: "Shinkai Makoto",
    translator: "", // Test không có dịch giả
    tags: ["Romance", "Drama"],
    description: "Khoảng cách giữa hai trái tim liệu có xa hơn khoảng cách giữa hai tinh cầu quay quanh mặt trời?",
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80",
    chapters: [
      { title: "Chương 1: Tiếng còi tàu", chapterNumber: 1, content: "Hai đoàn tàu lướt qua nhau trong tích tắc.", images: [] },
    ],
  },
  {
    title: "Chiến Binh Rồng Cổ Đại",
    author: "Toriyama Akira",
    translator: "Sutie Team",
    tags: ["Action", "Adventure", "Fantasy"],
    description: "Truyền thuyết về những chiến binh mang huyết mạch long tộc thức tỉnh để bảo vệ bình nguyên.",
    image: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80",
    chapters: [
      { title: "Chương 1: Long hống", chapterNumber: 1, content: "Ngọn lửa rực cháy trên đỉnh núi tuyết.", images: [] },
      { title: "Chương 2: Thử thách long thần", chapterNumber: 2, content: "Vượt qua thử thách để nhận ban phước.", images: [] },
    ],
  },
  {
    title: "Bí Mật Dưới Lòng Đại Dương",
    author: "Oda Eiichiro",
    translator: "Nhóm Dịch Cầu Vồng",
    tags: ["Adventure", "Mystery", "Comedy"],
    description: "Hành trình khám phá vương quốc cổ đại bị chìm sâu dưới đáy đại dương hàng ngàn năm trước.",
    image: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&auto=format&fit=crop&q=80",
    chapters: [
      { title: "Chương 1: Lặn sâu vạn dặm", chapterNumber: 1, content: "Ánh sáng phát quang từ những rạn san hô khổng lồ.", images: [] },
    ],
  },
  {
    title: "Kẻ Xuyên Không Vào Tiểu Thuyết Ác Nữ",
    author: "Han Yurang",
    translator: "Bạch Nguyệt Quang",
    tags: ["Fantasy", "Romance", "Comedy"],
    description: "Tỉnh dậy thành nhân vật phản diện trong cuốn tiểu thuyết yêu thích, cô quyết tâm sống cuộc đời an nhàn.",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80",
    chapters: [
      { title: "Chương 1: Thức tỉnh trong nhung lụa", chapterNumber: 1, content: "Ủa khoan, mình là ác nữ số một đế quốc sao?", images: [] },
      { title: "Chương 2: Lập kế hoạch sinh tồn", chapterNumber: 2, content: "Tránh xa nam chính và nữ chính càng xa càng tốt!", images: [] },
    ],
  },
  {
    title: "Đêm Trăng Máu: Ma Cà Rồng Trỗi Dậy",
    author: "Ishida Sui",
    translator: "Kuro Neko",
    tags: ["Supernatural", "Action", "Horror"],
    description: "Giữa lòng thành phố Tokyo hiện đại, một giống loài săn đêm ẩn mình sau những chiếc bóng râm.",
    image: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80",
    chapters: [
      { title: "Chương 1: Huyết nguyệt", chapterNumber: 1, content: "Ánh trăng đỏ phủ bóng xuống những con hẻm.", images: [] },
    ],
  },
  {
    title: "Quán Cà Phê Mèo Góc Phố",
    author: "Mochizuki Jun",
    translator: "", // Test không có dịch giả
    tags: ["Slice of Life", "Comedy"],
    description: "Những câu chuyện thường nhật dễ thương xoay quanh bầy mèo tinh nghịch và vị khách quen kì lạ.",
    image: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800&auto=format&fit=crop&q=80",
    chapters: [
      { title: "Chương 1: Ngày khai trương ồn ào", chapterNumber: 1, content: "Chú mèo mướp lười biếng ngủ quên trên quầy thu ngân.", images: [] },
      { title: "Chương 2: Vị khách bí ẩn", chapterNumber: 2, content: "Người khách mang theo hộp pate cá ngừ hảo hạng.", images: [] },
    ],
  },
  {
    title: "Thần Kiếm Trảm Yêu",
    author: "Kishimoto Masashi",
    translator: "Sutie Team",
    tags: ["Action", "Supernatural", "Historical"],
    description: "Thời kỳ chiến quốc loạn lạc, thanh kiếm cổ trấn áp ngàn vạn yêu ma rơi vào tay chàng thiếu niên dũng cảm.",
    image: "https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop&q=80",
    chapters: [
      { title: "Chương 1: Kiếm gãy phong ấn", chapterNumber: 1, content: "Lưỡi kiếm phát ra ánh sáng lam lấp lánh.", images: [] },
    ],
  },
  {
    title: "Lời Hẹn Ước Dưới Cơn Mưa Rào",
    author: "Asano Inio",
    translator: "Mèo Cam Sub",
    tags: ["Romance", "School Life", "Drama"],
    description: "Chiếc ô vàng che chung ngày mưa tan trường mở đầu cho chuỗi ngày thanh xuân đáng nhớ nhất đời học sinh.",
    image: "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=800&auto=format&fit=crop&q=80",
    chapters: [
      { title: "Chương 1: Chiếc ô màu vàng", chapterNumber: 1, content: "Cơn mưa rào đầu hạ và tiếng đập rộn ràng của trái tim.", images: [] },
    ],
  },
  {
    title: "Nhật Ký Của Một Phù Thủy Tập Sự",
    author: "Arakawa Hiromu",
    translator: "Hội Người Lười",
    tags: ["Fantasy", "Comedy", "Magic"],
    description: "Học viện phép thuật không hề lung linh như trong mơ, đặc biệt là khi bạn hay pha nổ vạc độc dược!",
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80",
    chapters: [
      { title: "Chương 1: Cây chổi biết bay", chapterNumber: 1, content: "Lần đầu tập bay và cú hạ cánh vào bụi cây.", images: [] },
      { title: "Chương 2: Công thức độc dược số 9", chapterNumber: 2, content: "Nồi thuốc phát nổ biến mái tóc thành màu tím rực.", images: [] },
    ],
  },
  {
    title: "Hành Tinh Băng Giá",
    author: "Nihei Tsutomu",
    translator: "", // Test không có dịch giả
    tags: ["Sci-Fi", "Mystery", "Survival"],
    description: "Nhiệt độ hạ xuống âm 60 độ, những người sống sót cuối cùng trong boong-ke bắt đầu cuộc di cư mạo hiểm.",
    image: "https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?w=800&auto=format&fit=crop&q=80",
    chapters: [
      { title: "Chương 1: Cơn bão tuyết vĩnh cửu", chapterNumber: 1, content: "Băng giá bao phủ toàn bộ lục địa cũ.", images: [] },
    ],
  },
  {
    title: "Bữa Tối Của Quái Vật",
    author: "Fujimoto Tatsuki",
    translator: "Aowu Scan",
    tags: ["Comedy", "Fantasy", "Cooking"],
    description: "Cách chế biến những nguyên liệu kỳ dị trong hầm ngục thành các món ăn thượng hạng hảo hạng nhất.",
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80",
    chapters: [
      { title: "Chương 1: Lẩu nấm độc dơi đen", chapterNumber: 1, content: "Thưởng thức món lẩu đặc sản tầng 3 hầm ngục.", images: [] },
      { title: "Chương 2: Bít-tết bò cạp lửa", chapterNumber: 2, content: "Thịt giòn rụm bên ngoài, mềm mọng bên trong.", images: [] },
    ],
  },
  {
    title: "Tiếng Đàn Trong Hoàng Hôn",
    author: "Naoshi Arakawa",
    translator: "Sutie Team",
    tags: ["Drama", "Music", "Romance"],
    description: "Tiếng vĩ cầm vang lên vào buổi chiều tà đánh thức những giai điệu tưởng chừng đã ngủ quên mãi mãi.",
    image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80",
    chapters: [
      { title: "Chương 1: Bản sonata mùa xuân", chapterNumber: 1, content: "Những ngón tay lướt trên phím đàn dương cầm.", images: [] },
    ],
  },
  {
    title: "Thám Tử Siêu Nhiên",
    author: "Gosho Aoyama",
    translator: "Kuro Neko",
    tags: ["Mystery", "Supernatural", "Psychological"],
    description: "Những vụ án kỳ lạ tưởng như bế tắc được làm sáng tỏ bởi khả năng nhìn thấy ký ức đồ vật.",
    image: "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=800&auto=format&fit=crop&q=80",
    chapters: [
      { title: "Chương 1: Chiếc gương nứt", chapterNumber: 1, content: "Ký ức cuối cùng được ghi lại trong tấm gương cổ.", images: [] },
      { title: "Chương 2: Bức tranh không lời", chapterNumber: 2, content: "Dấu vết ẩn dưới lớp sơn dầu ngàn năm.", images: [] },
    ],
  },
  {
    title: "Vườn Bách Thảo Của Kẻ Mộng Mơ",
    author: "Urushibara Yuki",
    translator: "", // Test không có dịch giả
    tags: ["Slice of Life", "Supernatural"],
    description: "Mỗi loài hoa trong khu vườn kỳ bí đều mang một linh hồn và một câu chuyện chưa từng được kể.",
    image: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800&auto=format&fit=crop&q=80",
    chapters: [
      { title: "Chương 1: Hoa dạ lan thức giấc", chapterNumber: 1, content: "Hương thơm ngọt ngào lan tỏa khi màn đêm buông xuống.", images: [] },
    ],
  },
  {
    title: "Võ Thần Nghịch Thiên",
    author: "Ngã Cật Tây Hồng Thị",
    translator: "Bạch Nguyệt Quang",
    tags: ["Action", "Martial Arts", "Adventure"],
    description: "Một thiếu niên phế vật bị gia tộc ruồng bỏ, trùng sinh trở lại với bí kíp nghịch thiên cải mệnh.",
    image: "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800&auto=format&fit=crop&q=80",
    chapters: [
      { title: "Chương 1: Trùng sinh thiếu niên", chapterNumber: 1, content: "Ta của kiếp này tuyệt đối không để ai chèn ép!", images: [] },
      { title: "Chương 2: Phá vỡ gông cùm", chapterNumber: 2, content: "Khai mở kinh mạch đệ nhất thiên hạ.", images: [] },
    ],
  },
  {
    title: "Trại Hè Kỳ Bí",
    author: "Urasawa Naoki",
    translator: "Nhóm Dịch Cầu Vồng",
    tags: ["Mystery", "Adventure", "School Life"],
    description: "Chuyến dã ngoại mùa hè biến thành cuộc phiêu lưu bất tận khi chiếc xe buýt đi lạc vào ngôi làng bị lãng quên.",
    image: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&auto=format&fit=crop&q=80",
    chapters: [
      { title: "Chương 1: Chuyến xe buýt số 13", chapterNumber: 1, content: "Màn sương dày đặc bao phủ cung đường quen thuộc.", images: [] },
    ],
  },
  {
    title: "Bầu Trời Sau Cơn Bão",
    author: "Kugane Maruyama",
    translator: "Sutie Team",
    tags: ["Drama", "Slice of Life", "Romance"],
    description: "Sau những ngày dông bão mù mịt, ánh cầu vồng rực rỡ nhất sẽ luôn xuất hiện nơi chân trời hy vọng.",
    image: "https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=800&auto=format&fit=crop&q=80",
    chapters: [
      { title: "Chương 1: Ánh cầu vồng", chapterNumber: 1, content: "Bầu trời lại trong xanh và ấm áp như chưa từng có giông bão.", images: [] },
      { title: "Chương 2: Chân trời mới", chapterNumber: 2, content: "Cùng nhau bước tiếp chặng đường phía trước.", images: [] },
    ],
  },
];

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sutie_reader';
  console.log(`Đang kết nối tới MongoDB: ${uri}...`);
  await mongoose.connect(uri);

  console.log('Thu thập danh sách tags...');
  const allTags = Array.from(new Set(mockComics.flatMap(c => c.tags)));
  
  for (const tagName of allTags) {
    await Tag.findOneAndUpdate(
      { name: tagName.toLowerCase() },
      { name: tagName.toLowerCase() },
      { upsert: true, new: true }
    );
  }
  console.log(`✅ Đã đồng bộ ${allTags.length} tags vào collection "genres"`);

  console.log('Bắt đầu chèn 23 bộ truyện...');
  const now = Date.now();
  
  for (let i = 0; i < mockComics.length; i++) {
    const item = mockComics[i];
    // Tạo ngày tạo lệch nhau một chút để dễ test sắp xếp
    const createdAt = new Date(now - (mockComics.length - i) * 3600 * 1000 * 4);
    
    await Post.create({
      title: item.title,
      description: item.description,
      author: item.author,
      translator: item.translator,
      tags: item.tags.map(t => t.toLowerCase()),
      images: [item.image],
      content: item.chapters[0]?.content || '',
      chapters: item.chapters.map(ch => ({
        title: ch.title,
        chapterNumber: ch.chapterNumber,
        content: ch.content,
        images: [item.image],
      })),
      createdAt,
      updatedAt: createdAt,
    });
  }

  const finalCount = await Post.countDocuments();
  console.log(`🎉 Thành công! Hiện có ${finalCount} bộ truyện trong database.`);
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Lỗi khi chèn dữ liệu:', err);
  process.exit(1);
});
