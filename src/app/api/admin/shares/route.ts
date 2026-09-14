import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Post } from '@/models/Post';
import { User } from '@/models/User';
import { isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json(
        { error: 'Không có quyền truy cập. Chỉ Quản trị viên mới được xem danh sách này.' },
        { status: 403 }
      );
    }

    await connectDB();

    // Find all posts that have recorded accessedUsers
    const rawPosts = await Post.find({
      'accessedUsers.0': { $exists: true },
    })
      .select('title author translator accessType images tags accessedUsers createdAt')
      .lean();

    // Collect all emails to get fresh user info from the database
    const allEmails = new Set<string>();
    for (const post of rawPosts) {
      if (Array.isArray(post.accessedUsers)) {
        for (const u of post.accessedUsers) {
          if (u.email) {
            allEmails.add(u.email.toLowerCase().trim());
          }
        }
      }
    }

    const registeredUsers = await User.find({
      email: { $in: Array.from(allEmails) },
    })
      .select('_id email name avatar role')
      .lean();

    const userMap = new Map<string, { _id: string; name: string; avatar: string; role: string }>();
    for (const u of registeredUsers) {
      userMap.set(u.email.toLowerCase().trim(), {
        _id: u._id.toString(),
        name: u.name || '',
        avatar: u.avatar || '',
        role: u.role || 'guest',
      });
    }

    const uniqueGuestEmails = new Set<string>();
    let totalGuestVisits = 0;

    const formattedPosts = [];

    for (const post of rawPosts) {
      if (!Array.isArray(post.accessedUsers) || post.accessedUsers.length === 0) {
        continue;
      }

      // Filter visitors who have role 'guest' (either recorded in accessedUsers or current DB role)
      const guestUsers = post.accessedUsers.filter((u: any) => {
        const email = (u.email || '').toLowerCase().trim();
        const dbProfile = userMap.get(email);
        const currentRole = dbProfile?.role || u.role || 'guest';
        return currentRole === 'guest';
      });

      if (guestUsers.length === 0) {
        continue;
      }

      // Sort guest users by lastAccessedAt descending
      guestUsers.sort((a: any, b: any) => {
        const timeA = a.lastAccessedAt ? new Date(a.lastAccessedAt).getTime() : 0;
        const timeB = b.lastAccessedAt ? new Date(b.lastAccessedAt).getTime() : 0;
        return timeB - timeA;
      });

      const mostRecentAccess = guestUsers[0]?.lastAccessedAt
        ? new Date(guestUsers[0].lastAccessedAt).toISOString()
        : (post.createdAt ? new Date(post.createdAt).toISOString() : new Date().toISOString());

      const mappedGuestUsers = guestUsers.map((u: any) => {
        const email = (u.email || '').toLowerCase().trim();
        const dbProfile = userMap.get(email);
        uniqueGuestEmails.add(email);
        totalGuestVisits += 1;

        return {
          userId: u.userId ? u.userId.toString() : dbProfile?._id,
          email,
          name: dbProfile?.name || u.name || email.split('@')[0],
          avatar: dbProfile?.avatar || u.avatar || '',
          role: 'guest' as const,
          lastAccessedAt: u.lastAccessedAt
            ? new Date(u.lastAccessedAt).toISOString()
            : mostRecentAccess,
        };
      });

      formattedPosts.push({
        _id: post._id.toString(),
        title: post.title,
        author: post.author || 'Không rõ tác giả',
        translator: post.translator || '',
        accessType: post.accessType || 'restricted',
        thumbnail: post.images?.[0] || '',
        images: post.images || [],
        tags: post.tags || [],
        createdAt: post.createdAt ? new Date(post.createdAt).toISOString() : undefined,
        lastGuestAccess: mostRecentAccess,
        totalGuestVisits: mappedGuestUsers.length,
        guestUsers: mappedGuestUsers,
      });
    }

    // Sort stories by lastGuestAccess descending (newest guest access first)
    formattedPosts.sort((a, b) => {
      const timeA = new Date(a.lastGuestAccess).getTime();
      const timeB = new Date(b.lastGuestAccess).getTime();
      return timeB - timeA;
    });

    return NextResponse.json({
      posts: formattedPosts,
      stats: {
        totalStoriesWithGuests: formattedPosts.length,
        totalUniqueGuests: uniqueGuestEmails.size,
        totalGuestVisits,
      },
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách truyện chia sẻ cho khách:', error);
    return NextResponse.json(
      { error: 'Không thể tải danh sách truyện chia sẻ' },
      { status: 500 }
    );
  }
}
