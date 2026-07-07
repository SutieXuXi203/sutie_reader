'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/providers/AuthContext';
import { notify } from '@/lib/notify';
import { Footer } from '@/components/Footer';

export default function ContactPage() {
  const { user } = useAuth();
  const [isSending, setIsSending] = useState(false);

  const handleContactSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSending(true);
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
        (e.target as HTMLFormElement).reset();
        notify.success('Đã gửi tin nhắn', 'Cảm ơn bạn, tôi sẽ phản hồi sớm nhất có thể.');
      } else {
        const errorData = await response.json();
        notify.error(errorData.error || 'Có lỗi xảy ra, vui lòng thử lại.');
      }
    } catch (error) {
      console.error('Lỗi khi gửi liên hệ:', error);
      notify.error('Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setIsSending(false);
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors pt-24 pb-0 flex flex-col justify-between relative">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(theme(colors.primary)_1px,transparent_1px)] opacity-[0.05] z-0 mix-blend-screen" />
      
      {/* Decorative Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        <div className="absolute top-[8%] left-[2%] w-48 h-48 rounded-full border border-primary/10 bg-primary/5 opacity-30 animate-float-y-soft float-y-fast" />
        <div className="absolute top-[20%] right-[10%] w-72 h-72 rounded-full bg-primary/10 blur-[120px] opacity-20 animate-float-y-soft float-y-slow" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex flex-col items-center">
        <div className="max-w-2xl w-full mt-4">
          <div className="mb-8">
            <Link href="/" passHref>
              <Button variant="ghost" size="sm" className="mb-4 -ml-4 text-primary rounded-[8px] hover:bg-secondary transition-colors font-bold">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Quay lại trang chủ
              </Button>
            </Link>
          </div>

          {/* Contact Form Section Stretched */}
          <section className="border border-border bg-card/50 backdrop-blur-md rounded-[16px] p-6 md:p-8 shadow-sm">
          <div className="text-center mb-6">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1.5 flex items-center justify-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              Liên hệ
            </p>
            <h2 className="text-lg sm:text-xl font-extrabold text-foreground mb-2">Kết nối với tôi</h2>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Có ý tưởng, câu hỏi, hoặc đơn giản chỉ muốn nói chuyện? Tôi rất vui khi được lắng nghe.
            </p>
          </div>
          
          <form onSubmit={handleContactSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-foreground mb-1">Tên</label>
                {user ? (
                  <input
                    key="user-name"
                    type="text"
                    name="name"
                    value={user.name || ''}
                    readOnly
                    className="w-full px-3 py-2 border border-border rounded-[8px] bg-secondary text-muted-foreground text-xs cursor-not-allowed"
                  />
                ) : (
                  <input
                    key="guest-name"
                    required
                    type="text"
                    name="name"
                    placeholder="Tên của bạn"
                    className="w-full px-3 py-2 border border-border rounded-[8px] bg-background text-foreground text-xs focus:outline-none focus:border-primary transition-colors"
                  />
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-foreground mb-1">Email</label>
                {user ? (
                  <input
                    key="user-email"
                    type="email"
                    name="email"
                    value={user.email || ''}
                    readOnly
                    className="w-full px-3 py-2 border border-border rounded-[8px] bg-secondary text-muted-foreground text-xs cursor-not-allowed"
                  />
                ) : (
                  <input
                    key="guest-email"
                    required
                    type="email"
                    name="email"
                    placeholder="email@example.com"
                    className="w-full px-3 py-2 border border-border rounded-[8px] bg-background text-foreground text-xs focus:outline-none focus:border-primary transition-colors"
                  />
                )}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-foreground mb-1">Tin nhắn</label>
              <textarea
                required
                name="message"
                rows={4}
                placeholder="Nội dung tin nhắn..."
                className="w-full px-3 py-2 border border-border rounded-[8px] bg-background text-foreground text-xs focus:outline-none focus:border-primary transition-colors resize-none"
              />
            </div>
            <Button type="submit" disabled={isSending} className="w-full h-9 rounded-[8px] bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold disabled:opacity-50 transition-colors">
              {isSending ? 'Đang gửi...' : 'Gửi tin nhắn'}
            </Button>
          </form>
        </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
