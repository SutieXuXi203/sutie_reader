import Link from 'next/link';
import { Home, Compass, BookOpen } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center px-4 py-16 text-center select-none">
      <div className="relative mb-6">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xl shadow-primary/5 mx-auto">
          <BookOpen className="w-10 h-10 sm:w-12 sm:h-12 stroke-[1.75]" />
        </div>
        <span className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary text-primary-foreground shadow-md">
          404
        </span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mb-3">
        Không tìm thấy nội dung
      </h1>

      <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto mb-8 leading-relaxed">
        Trang truyện hoặc nội dung bạn đang tìm kiếm không tồn tại, đã được chuyển đi hoặc bạn chưa được cấp quyền truy cập.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
        >
          <Home className="w-4 h-4" />
          Về trang chủ
        </Link>

        <Link
          href="/contact"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-background/80 hover:bg-muted text-foreground text-sm font-medium active:scale-95 transition-all shadow-xs"
        >
          <Compass className="w-4 h-4 text-muted-foreground" />
          Báo lỗi / Liên hệ
        </Link>
      </div>
    </div>
  );
}
