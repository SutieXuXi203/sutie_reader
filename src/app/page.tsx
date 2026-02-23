'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Plus, BookOpen, Mail, Github, ArrowDown, Home as HomeIcon, LogOut, User as UserIcon, LogIn, Lock } from 'lucide-react';
import { PostCard } from '@/components/PostCard';
import { CreatePostForm } from '@/components/CreatePostForm';
import { AuthDialog } from '@/components/AuthDialog';
import { useAuth } from '@/providers/AuthContext';

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
  const { user, logout, isLoading: isAuthLoading } = useAuth();
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

  const handlePostDeleted = (postId: string) => {
    setPosts((prev) => prev.filter((post) => post._id !== postId));
  };

  const handleContactSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setContactSent(true);
    (e.target as HTMLFormElement).reset();
    setTimeout(() => setContactSent(false), 4000);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors">

      {/* ── SIDEBAR NAVBAR ── */}
      <nav className="fixed top-0 left-0 bottom-0 z-50 w-36 flex flex-col items-center py-6 gap-6
        bg-transparent border-slate-100 dark:border-slate-800/40">
        {/* Logo */}
        <div className="flex flex-col items-center gap-1">
          <BookOpen className="w-6 h-6 text-slate-700 dark:text-slate-300" />
          <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 tracking-widest uppercase">blog</span>
        </div>

        <div className="w-6 h-px bg-slate-200 dark:bg-slate-800" />

        {/* Nav links */}
        <div className="flex flex-col items-center justify-center gap-5 flex-1">
          <a href="/"
            title="Trang chủ"
            className="flex flex-col items-center gap-1 text-[9px] text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
            <HomeIcon className="w-5 h-5" />
            Trang chủ
          </a>
          <a href="#posts"
            title="Bài viết"
            className="flex flex-col items-center gap-1 text-[9px] text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors group">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Bài viết
          </a>
          <a href="#contact"
            title="Liên hệ"
            className="flex flex-col items-center gap-1 text-[9px] text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
            <Mail className="w-5 h-5" />
            Liên hệ
          </a>
        </div>

        {/* Bottom actions */}
        <div className="flex flex-col items-center gap-4">
          {user ? (
            <>
              <button
                onClick={() => setIsCreateDialogOpen(true)}
                title="Viết bài"
                className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-black hover:opacity-80 transition-all shadow-md active:scale-95"
              >
                <Plus className="w-5 h-5" />
              </button>

              <div className="w-8 h-[1px] bg-slate-200 dark:bg-slate-800 my-1" />

              <div className="group relative">
                <button
                  className="w-10 h-10 rounded-full overflow-hidden border-2 border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-all"
                >
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <UserIcon className="w-5 h-5 text-slate-400" />
                    </div>
                  )}
                </button>

                {/* User context menu */}
                <div className="absolute left-full ml-4 bottom-0 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-x-[-10px] group-hover:translate-x-0 z-[100] p-1">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={() => logout()}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Đăng xuất
                  </button>
                </div>
              </div>
            </>
          ) : (
            <button
              onClick={() => setIsAuthDialogOpen(true)}
              title="Đăng nhập"
              className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-all active:scale-95"
            >
              <LogIn className="w-5 h-5" />
            </button>
          )}
          <ThemeToggle />
        </div>
      </nav>

      {/* ── HERO SECTION ── */}
      <section className="relative min-h-screen flex items-center justify-center pl-56 px-12 overflow-hidden snap-start">
        {/* Background gradient blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-slate-200/20 dark:bg-slate-800/20 rounded-full blur-3xl opacity-50" />
          <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-slate-100/30 dark:bg-slate-900/10 rounded-full blur-3xl opacity-50" />
        </div>

        <div className="relative z-10 max-w-3xl w-full text-center">
          <div className="hero-animate inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-xs font-medium px-3 py-1.5 rounded-full mb-8 border border-slate-200 dark:border-slate-800">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            Chia sẻ câu chuyện của bạn
          </div>

          <h1 className="hero-animate hero-delay-1 text-5xl md:text-7xl font-bold text-slate-900 dark:text-white mb-6 leading-tight tracking-tight">
            Nơi{' '}
            <span>
              ý tưởng
            </span>{' '}
            trở thành câu chuyện
          </h1>

          <p className="hero-animate hero-delay-2 text-lg md:text-xl text-slate-500 dark:text-slate-400 mb-12 font-light leading-relaxed max-w-xl mx-auto">
            Tạo, chia sẻ và khám phá những bài viết đầy cảm hứng cùng hình ảnh sống động.
          </p>

          <div className="hero-animate hero-delay-3 flex flex-col sm:flex-row gap-4 justify-center">
            {user ? (
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                size="lg"
                className="rounded-full px-8 py-3 text-base font-semibold bg-slate-900 dark:bg-white text-white dark:text-black hover:opacity-90 border-0 shadow-xl"
              >
                <Plus className="w-5 h-5 mr-2" />
                Tạo bài viết
              </Button>
            ) : (
              <Button
                onClick={() => setIsAuthDialogOpen(true)}
                size="lg"
                className="rounded-full px-8 py-3 text-base font-semibold bg-slate-900 dark:bg-white text-white dark:text-black hover:opacity-90 border-0 shadow-xl"
              >
                <LogIn className="w-5 h-5 mr-2" />
                Bắt đầu ngay
              </Button>
            )}
            <Button
              variant="outline"
              size="lg"
              className="rounded-full px-8 py-3 text-base"
              onClick={() => document.getElementById('posts')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Khám phá
              <ArrowDown className="w-4 h-4 ml-2" />
            </Button>
          </div>

        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-slate-400">
          <span className="text-xs">Cuộn xuống</span>
          <div className="w-px h-8 bg-gradient-to-b from-slate-300 to-transparent" />
        </div>
      </section>

      {/* ── POSTS SECTION ── */}
      <section id="posts" className="min-h-screen flex items-center py-32 pl-56 px-12 bg-slate-50 dark:bg-slate-900/50 snap-start">
        <div className="max-w-7xl mx-auto w-full">
          {/* Section header */}
          <div className="reveal flex items-end justify-between mb-12">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-2 uppercase tracking-widest">Khám phá</p>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">Bài viết mới nhất</h2>
            </div>
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              variant="outline"
              size="sm"
              className="rounded-full hidden sm:flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Viết bài
            </Button>
          </div>

          {/* Conditionally render content */}
          {isLoading || isAuthLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white dark:bg-slate-800 rounded-xl h-72 animate-pulse" />
              ))}
            </div>
          ) : !user ? (
            <div className="reveal hero-delay-2 flex flex-col items-center justify-center py-20 px-6 bg-white dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                <Lock className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Nội dung đã bị khóa</h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-8">
                Bạn cần đăng nhập hoặc tạo tài khoản mới để có thể xem được danh sách các bài viết và câu chuyện.
              </p>
              <Button
                onClick={() => setIsAuthDialogOpen(true)}
                className="rounded-full px-8 bg-slate-900 dark:bg-white text-white dark:text-black hover:opacity-90"
              >
                Đăng nhập ngay
              </Button>
            </div>
          ) : posts.length === 0 ? (
            <div className="reveal hero-delay-2 text-center py-24">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
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
      <section id="contact" className="min-h-screen flex items-center py-32 pl-56 px-12 snap-start">
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
                <a href="mailto:hello@myblog.com"
                  className="flex items-center gap-3 text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white transition-colors group">
                  <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                    <Mail className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">hello@myblog.com</span>
                </a>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white transition-colors group">
                  <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                    <Github className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">github.com/myblog</span>
                </a>
              </div>
            </div>

            {/* Right: form */}
            <div className="reveal reveal-delay-2 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-8 border border-slate-100 dark:border-slate-700">
              {contactSent ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
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
                    <input
                      required
                      type="text"
                      placeholder="Tên của bạn"
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
                    <input
                      required
                      type="email"
                      placeholder="email@example.com"
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Tin nhắn</label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Nội dung tin nhắn..."
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition resize-none"
                    />
                  </div>
                  <Button type="submit" className="w-full rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-black hover:opacity-90 border-0">
                    Gửi tin nhắn
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-100 dark:border-slate-800 py-12 pl-56 px-12 snap-start">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <BookOpen className="w-4 h-4" />
            <span className="text-sm font-medium">myblog</span>
          </div>
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} myblog. All rights reserved.</p>
          <div className="flex gap-5 text-xs text-slate-400">
            <a href="#posts" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Bài viết</a>
            <a href="#contact" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Liên hệ</a>
          </div>
        </div>
      </footer>

      {/* Create Post Dialog */}
      <AuthDialog
        open={isAuthDialogOpen}
        onOpenChange={setIsAuthDialogOpen}
      />

      <CreatePostForm
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onPostCreated={fetchPosts}
      />
    </div>
  );
}
