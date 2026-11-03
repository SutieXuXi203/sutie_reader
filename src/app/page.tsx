import { HeroSection } from '@/components/portfolio/HeroSection';
import { HorizontalProjects } from '@/components/portfolio/HorizontalProjects';
import { BentoGrid } from '@/components/portfolio/BentoGrid';
import { ExperienceTimeline } from '@/components/portfolio/ExperienceTimeline';
import { ContactSection } from '@/components/portfolio/ContactSection';
import { Footer } from '@/components/portfolio/Footer';

export const metadata = {
  title: 'Alex Nguyen — Creative Technologist & Fullstack Engineer',
  description:
    'Portfolio of Alex Nguyen. Specializing in Next.js 16, React 19, GSAP 3 motion physics, and high-performance spatial web architectures.',
};

export default function PortfolioPage() {
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col selection:bg-foreground selection:text-background relative">
      <HeroSection />
      <HorizontalProjects />
      <BentoGrid />
      <ExperienceTimeline />
      <ContactSection />
      <Footer />
    </main>
  );
}
