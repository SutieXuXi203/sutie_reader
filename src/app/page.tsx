'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Plus, BookOpen, Mail, Github, Facebook, ArrowDown, Home as HomeIcon, LogOut, User as UserIcon, LogIn, Lock, LayoutDashboard, FileText } from 'lucide-react';
import { PostCard } from '@/components/PostCard';
import dynamic from 'next/dynamic';
import { useAuth } from '@/providers/AuthContext';
import Link from 'next/link';
import Image from 'next/image';

const CreatePostForm = dynamic(() => import('@/components/CreatePostForm').then(m => ({ default: m.CreatePostForm })), { ssr: false });
const AuthDialog = dynamic(() => import('@/components/AuthDialog').then(m => ({ default: m.AuthDialog })), { ssr: false });
const ProfileDialog = dynamic(() => import('@/components/ProfileDialog').then(m => ({ default: m.ProfileDialog })), { ssr: false });

interface Post {
  _id: string;
  title: string;
  description: string;
  content: string;
  images: string[];
  author: string;
  createdAt: string;
  updatedAt: string;
}

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout, isLoading: isAuthLoading, isAdmin } = useAuth();
  const [contactSent, setContactSent] = useState(false);

  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [posts, user, isLoading, isAuthLoading]);

  const fetchPosts = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/posts');
      if (response.ok) {
        const data = await response.json();
        setPosts(data);
      }
    } catch (error) {
      console.error('Lỗi khi tải bài viết:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handlePostDeleted = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((post) => post._id !== postId));
  }, []);

  const [isSending, setIsSending] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  const handleContactSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSending(true);
    setContactError(null);
    setContactSent(false);

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string || user?.name || '';
    const email = formData.get('email') as string || user?.email || '';
    const message = formData.get('message') as string;

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });

      if (response.ok) {
        setContactSent(true);
        (e.target as HTMLFormElement).reset();
        setTimeout(() => setContactSent(false), 5000);
      } else {
        const errorData = await response.json();
        setContactError(errorData.error || 'Có lỗi xảy ra, vui lòng thử lại.');
      }
    } catch (error) {
      console.error('Lỗi khi gửi liên hệ:', error);
      setContactError('Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setIsSending(false);
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors">

      {/* ── SIDEBAR NAVBAR ── */}
      <nav className="fixed top-0 left-0 bottom-0 z-50 w-24 flex flex-col items-center py-8 gap-8
        bg-transparent transition-all duration-300">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 bg-slate-900 dark:bg-white rounded-none flex items-center justify-center text-white dark:text-black shadow-lg">
            <BookOpen className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold text-slate-900 dark:text-white tracking-[0.2em] uppercase">blog</span>
        </div>

        <div className="w-10 h-px bg-slate-100 dark:bg-slate-800" />

        {/* Nav links */}
        <div className="flex flex-col items-center justify-center gap-8 flex-1">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            title="Trang chủ"
            className="flex flex-col items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-all hover:scale-110 active:scale-95 cursor-pointer">
            <HomeIcon className="w-6 h-6" />
            Trang chủ
          </button>
          <a href="#posts"
            title="Bài viết"
            className="flex flex-col items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-all hover:scale-110 active:scale-95 group">
            <FileText className="w-6 h-6" />
            Bài viết
          </a>
          <a href="#contact"
            title="Liên hệ"
            className="flex flex-col items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-all hover:scale-110 active:scale-95">
            <Mail className="w-6 h-6" />
            Liên hệ
          </a>
          {isAdmin && (
            <Link href="/admin"
              title="Dashboard"
              className="flex flex-col items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-slate-900 dark:text-white hover:opacity-70 transition-all hover:scale-110 active:scale-95">
              <LayoutDashboard className="w-6 h-6" />
              Quản trị
            </Link>
          )}
        </div>

        {/* Bottom actions */}
        <div className="flex flex-col items-center gap-6">
          {user ? (
            <>
              <div className="group relative">
                <button
                  className="w-12 h-12 rounded-full overflow-hidden border-2 border-slate-100 dark:border-slate-800 hover:border-slate-900 dark:hover:border-white transition-all shadow-md"
                >
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <UserIcon className="w-6 h-6 text-slate-400" />
                    </div>
                  )}
                </button>

                {/* Profile dropdown */}
                <div className="absolute left-full ml-4 bottom-0 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-none shadow-2xl p-4 min-w-[240px] z-50 transform translate-x-[-10px] group-hover:translate-x-0">
                  <div className="px-3 py-2 border-b border-slate-50 dark:border-slate-800/50 mb-2">
                    <p className="text-sm font-black text-slate-900 dark:text-white truncate tracking-tight">{user.name}</p>
                    <p className="text-[11px] text-slate-400 truncate font-medium">{user.email}</p>
                  </div>
                  <button
                    onClick={() => setIsProfileDialogOpen(true)}
                    className="w-full flex items-center gap-3 px-3 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all border-b border-slate-50 dark:border-slate-800/50"
                  >
                    <UserIcon className="w-5 h-5" />
                    <span>Hồ sơ cá nhân</span>
                  </button>
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-3 py-3 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <button
              onClick={() => setIsAuthDialogOpen(true)}
              className="w-12 h-12 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:border-slate-900 dark:hover:border-slate-100 transition-all active:scale-95"
              title="Đăng nhập"
            >
              <LogIn className="w-6 h-6" />
            </button>
          )}

          <div className="w-8 h-px bg-slate-100 dark:bg-slate-800" />
          <ThemeToggle />
        </div>
      </nav>

      {/* ── HERO SECTION ── */}
      <section className="relative min-h-screen flex items-center justify-center px-12 pl-24 overflow-hidden snap-start">
        {/* Background gradient blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-slate-200/20 dark:bg-slate-800/20 rounded-none blur-3xl opacity-50" />
          <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-slate-100/30 dark:bg-slate-900/10 rounded-none blur-3xl opacity-50" />
        </div>

        <div className="relative z-10 max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* ── LEFT SIDE: TEXT CONTENT ── */}
          <div className="flex flex-col">
            <div className="hero-animate inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-xs font-medium px-3 py-1.5 rounded-none mb-8 border border-slate-200 dark:border-slate-800 w-fit">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-none animate-pulse" />
              Góc dịch thuật của Sutie
            </div>

            <h1 className="hero-animate hero-delay-1 text-5xl md:text-6xl font-bold text-slate-900 dark:text-white mb-6 leading-tight tracking-tight">
              Những bản{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400">
                dịch thuật
              </span>{' '}
              của Sutie Xù Xì
            </h1>

            <p className="hero-animate hero-delay-2 text-lg md:text-xl text-slate-500 dark:text-slate-400 mb-12 font-light leading-relaxed">
              Nơi tôi chia sẻ niềm đam mê ngôn ngữ qua từng trang sách và những câu chuyện được chuyển ngữ với tất cả tâm huyết.
            </p>

            <div className="hero-animate hero-delay-3 flex flex-col sm:flex-row gap-4">
              {user ? (
                isAdmin && (
                  <Button
                    onClick={() => setIsCreateDialogOpen(true)}
                    size="lg"
                    className="rounded-none px-8 py-3 text-base font-semibold bg-slate-900 dark:bg-white text-white dark:text-black hover:opacity-90 border-0 shadow-xl w-fit"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Tạo bài viết
                  </Button>
                )
              ) : (
                <Button
                  onClick={() => setIsAuthDialogOpen(true)}
                  size="lg"
                  className="rounded-none px-8 py-3 text-base font-semibold bg-slate-900 dark:bg-white text-white dark:text-black hover:opacity-90 border-0 shadow-xl w-fit"
                >
                  <LogIn className="w-5 h-5 mr-2" />
                  Bắt đầu ngay
                </Button>
              )}
              <Button
                variant="outline"
                size="lg"
                className="rounded-none px-8 py-3 text-base w-fit"
                onClick={() => document.getElementById('posts')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Khám phá
                <ArrowDown className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>

          {/* ── RIGHT SIDE: DRAGON IMAGE ── */}
          <div className="hero-animate hero-delay-2 flex items-center justify-center relative h-full min-h-96">
            <div className="group relative w-full max-w-[500px] aspect-square rounded-[8px] overflow-hidden cursor-pointer">
              <Image
                src="/dragon.png"
                alt="Sutie's Dragon Avatar"
                fill
                priority
                className="object-cover drop-shadow-2xl"
              />
              {/* Tooltip */}
              <div className="absolute inset-0 flex items-end justify-center pb-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                <div className="bg-black/75 backdrop-blur-sm text-white text-sm font-medium px-4 py-2 rounded-none max-w-[90%] text-center shadow-xl">
                  Hình ảnh là sản phẩm của AI và không có tác giả
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-slate-400">
          <span className="text-xs">Cuộn xuống</span>
          <div className="w-px h-8 bg-gradient-to-b from-slate-300 to-transparent" />
        </div>
      </section>

      {/* ── POSTS SECTION ── */}
      <section id="posts" className="min-h-screen flex items-center py-32 pl-24 px-12 bg-slate-50 dark:bg-slate-900/50 snap-start">
        <div className="max-w-7xl mx-auto w-full">
          {/* Section header */}
          <div className="reveal flex items-end justify-between mb-12">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-2 uppercase tracking-widest">Khám phá</p>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">Bài viết mới nhất</h2>
            </div>
            <Link href="/products" passHref>
              <Button
                variant="outline"
                size="sm"
                className="rounded-none hidden sm:flex items-center gap-1.5 hover:bg-slate-900 hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
              >
                Xem Tất Cả
              </Button>
            </Link>
          </div>

          {/* Conditionally render content */}
          {isLoading || isAuthLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white dark:bg-slate-800 rounded-none h-72 animate-pulse" />
              ))}
            </div>
          ) : !user ? (
            <div className="reveal hero-delay-2 flex flex-col items-center justify-center py-20 px-6 bg-white dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800 rounded-none text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-none flex items-center justify-center mb-6">
                <Lock className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Nội dung đã bị khóa</h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-8">
                Bạn cần đăng nhập hoặc tạo tài khoản mới để có thể xem được danh sách các bài viết và câu chuyện.
              </p>
              <Button
                onClick={() => setIsAuthDialogOpen(true)}
                className="rounded-none px-8 bg-slate-900 dark:bg-white text-white dark:text-black hover:opacity-90"
              >
                Đăng nhập ngay
              </Button>
            </div>
          ) : posts.length === 0 ? (
            <div className="reveal hero-delay-2 text-center py-24">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-none flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-7 h-7 text-slate-400" />
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-lg">Chưa có bài viết nào</p>
            </div>
          ) : (
            <div className="reveal hero-delay-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {posts.map((post) => (
                <PostCard
                  key={post._id}
                  post={post}
                  onDelete={handlePostDeleted}
                  onUpdate={fetchPosts}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── CONTACT SECTION ── */}
      <section id="contact" className="min-h-screen flex items-center py-32 pl-24 px-12 snap-start">
        <div className="max-w-5xl mx-auto w-full">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            {/* Left: info */}
            <div className="reveal">
              <p className="text-sm font-medium text-slate-500 mb-2 uppercase tracking-widest">Liên hệ</p>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-6">Kết nối với tôi</h2>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed mb-10">
                Có ý tưởng, câu hỏi, hoặc đơn giản chỉ muốn nói chuyện? Tôi rất vui khi được lắng nghe.
              </p>
              <div className="space-y-4">
                <a href="mailto:sutiexuxi.supp.0410@gmail.com"
                  className="flex items-center gap-3 text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white transition-colors group">
                  <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-none flex items-center justify-center group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                    <Mail className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">sutiexuxi.supp.0410@gmail.com</span>
                </a>
                <a href="https://github.com/DinhManh203" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white transition-colors group">
                  <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-none flex items-center justify-center group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                    <Github className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">https://github.com/DinhManh203</span>
                </a>
                <a href="https://www.facebook.com/profile.php?id=61585590627494" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white transition-colors group">
                  <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-none flex items-center justify-center group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                    <Facebook className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">Facebook</span>
                </a>
              </div>
            </div>

            {/* Right: form */}
            <div className="reveal reveal-delay-2 bg-slate-50 dark:bg-slate-800/50 rounded-none p-8 border border-slate-100 dark:border-slate-700">
              {contactSent ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-none flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="font-semibold text-slate-900 dark:text-white mb-1">Đã gửi!</p>
                  <p className="text-sm text-slate-500">Cảm ơn bạn, tôi sẽ phản hồi sớm nhất có thể.</p>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Tên</label>
                    {user ? (
                      <input
                        key="user-name"
                        type="text"
                        name="name"
                        value={user.name || ''}
                        readOnly
                        className="w-full px-4 py-2.5 rounded-none border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-sm cursor-not-allowed"
                      />
                    ) : (
                      <input
                        key="guest-name"
                        required
                        type="text"
                        name="name"
                        defaultValue=""
                        placeholder="Tên của bạn"
                        className="w-full px-4 py-2.5 rounded-none border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
                    {user ? (
                      <input
                        key="user-email"
                        type="email"
                        name="email"
                        value={user.email || ''}
                        readOnly
                        className="w-full px-4 py-2.5 rounded-none border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-sm cursor-not-allowed"
                      />
                    ) : (
                      <input
                        key="guest-email"
                        required
                        type="email"
                        name="email"
                        defaultValue=""
                        placeholder="email@example.com"
                        className="w-full px-4 py-2.5 rounded-none border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Tin nhắn</label>
                    <textarea
                      required
                      name="message"
                      rows={4}
                      placeholder="Nội dung tin nhắn..."
                      className="w-full px-4 py-2.5 rounded-none border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition resize-none"
                    />
                  </div>

                  {contactError && (
                    <p className="text-red-500 text-sm font-medium">{contactError}</p>
                  )}

                  <Button type="submit" disabled={isSending} className="w-full rounded-none bg-slate-900 dark:bg-white text-white dark:text-black hover:opacity-90 border-0 disabled:opacity-50">
                    {isSending ? 'Đang gửi...' : 'Gửi tin nhắn'}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-100 dark:border-slate-800 py-12 pl-24 px-12 snap-start">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <BookOpen className="w-4 h-4" />
            <span className="text-sm font-medium">Sutie Archive</span>
          </div>
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} Sutie Archive. Mọi quyền được bảo lưu.</p>
          <div className="flex gap-5 text-xs text-slate-400">
            <a href="#posts" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Bài viết</a>
            <a href="#contact" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Liên hệ</a>
          </div>
        </div>
      </footer>

      {/* Dialogs */}
      <AuthDialog
        open={isAuthDialogOpen}
        onOpenChange={setIsAuthDialogOpen}
      />

      <CreatePostForm
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onPostCreated={fetchPosts}
      />

      {user && (
        <ProfileDialog
          open={isProfileDialogOpen}
          onOpenChange={setIsProfileDialogOpen}
        />
      )}
    </div>
  );
}
