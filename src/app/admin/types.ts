export type AdminTabKey = 'posts' | 'shares' | 'users' | 'tags';

export interface Post {
    _id: string;
    title: string;
    description?: string;
    tags?: string[];
    content: string;
    images: string[];
    author: string;
    translator?: string;
    createdAt: string;
}

export interface AdminUser {
    _id: string;
    email: string;
    name?: string;
    role?: string;
    avatar?: string;
    isVerified?: boolean;
    createdAt: string;
}

export interface DeletedAccountRecord {
    _id: string;
    email: string;
    name?: string;
    role?: 'user' | 'admin';
    verificationExpiresAt?: string;
    deletionReason: 'unverified_expired_24h';
    deletionTrigger: 'login' | 'verify' | 'system';
    deletedAt: string;
}

export interface SharedGuestUser {
    userId?: string;
    email: string;
    name: string;
    avatar?: string;
    role: 'guest';
    lastAccessedAt: string;
}

export interface SharedStoryPost {
    _id: string;
    title: string;
    author: string;
    translator?: string;
    accessType: 'restricted' | 'public';
    thumbnail: string;
    images: string[];
    tags: string[];
    createdAt?: string;
    lastGuestAccess: string;
    totalGuestVisits: number;
    guestUsers: SharedGuestUser[];
}

export interface SharesStats {
    totalStoriesWithGuests: number;
    totalUniqueGuests: number;
    totalGuestVisits: number;
}

export const formatGuestAccessTime = (isoString?: string | Date) => {
    if (!isoString) return 'Chưa ghi nhận';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Chưa ghi nhận';
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return 'Vừa xong';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};
