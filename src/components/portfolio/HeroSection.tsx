'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { PORTFOLIO_DATA } from '@/data/portfolioData';
import { ArrowDown, ArrowUpRight, Sparkles, Terminal, Code2, Layers, Cpu } from 'lucide-react';

export function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useGSAP(
    () => {
      // Entrance timeline
      const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });

      tl.from('.hero-badge', {
        y: -20,
        opacity: 0,
        duration: 0.8,
        delay: 0.1,
      })
        .from('.hero-title-line', {
          y: 60,
          opacity: 0,
          rotateX: -20,
          stagger: 0.12,
          duration: 1,
        }, '-=0.5')
        .from('.hero-bio', {
          y: 20,
          opacity: 0,
          duration: 0.8,
        }, '-=0.6')
        .from('.hero-cta', {
          scale: 0.95,
          opacity: 0,
          duration: 0.6,
          stagger: 0.1,
        }, '-=0.4')
        .from('.hero-stat', {
          y: 30,
          opacity: 0,
          stagger: 0.08,
          duration: 0.8,
        }, '-=0.4')
        .from('.hero-widget', {
          scale: 0.9,
          opacity: 0,
          duration: 1,
        }, '-=0.8');
    },
    { scope: containerRef }
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    if (spotlightRef.current) {
      gsap.to(spotlightRef.current, {
        x: x - 250,
        y: y - 250,
        duration: 0.6,
        ease: 'power2.out',
      });
    }
  };

  return (
    <section
      id="hero"
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative min-h-[92vh] flex flex-col justify-center pt-28 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden select-none"
    >
      {/* Interactive mouse spotlight glow */}
      <div
        ref={spotlightRef}
        className="pointer-events-none absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-cyan-500/10 via-indigo-500/10 to-purple-500/15 blur-3xl opacity-70"
        style={{ willChange: 'transform' }}
      />

      <div className="max-w-6xl mx-auto w-full relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Headlines & Call to Actions */}
        <div className="lg:col-span-7 flex flex-col items-start gap-6">
          {/* Status Badge */}
          <div className="hero-badge inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-foreground/[0.04] border border-border/80 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              {PORTFOLIO_DATA.profile.status.label}
            </span>
          </div>

          {/* Headline with Kinetic Typography Stagger */}
          <div ref={headlineRef} className="space-y-1 sm:space-y-2">
            <h1 className="hero-title-line text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-foreground leading-[1.05]">
              CRAFTING DIGITAL
            </h1>
            <h1 className="hero-title-line text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-foreground/80 to-muted-foreground bg-clip-text text-transparent leading-[1.05]">
              EXPERIENCES WITH
            </h1>
            <h1 className="hero-title-line text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent leading-[1.05] flex items-center gap-3">
              <span>MOTION & CODE</span>
              <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-purple-400 animate-spin" style={{ animationDuration: '8s' }} />
            </h1>
          </div>

          {/* Subtitle / Bio */}
          <p className="hero-bio text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
            {PORTFOLIO_DATA.profile.tagline}
          </p>

          {/* Action Buttons */}
          <div className="hero-cta flex flex-wrap items-center gap-4 pt-2">
            <Link
              href="#projects"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-foreground text-background font-medium text-sm hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-foreground/10"
              data-cursor-pointer
            >
              <span>Explore Selected Works</span>
              <ArrowDown className="w-4 h-4 animate-bounce" />
            </Link>

            <Link
              href="#contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-border bg-background/50 hover:bg-foreground/5 text-foreground font-medium text-sm transition-all"
              data-cursor-pointer
            >
              <span>Get in Touch</span>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
            </Link>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-6 border-t border-border/40 w-full">
            {PORTFOLIO_DATA.profile.stats.map((stat, idx) => (
              <div key={idx} className="hero-stat flex flex-col">
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-mono">
                  {stat.value}
                </span>
                <span className="text-xs text-muted-foreground tracking-wide uppercase font-medium">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Interactive Code Terminal & Spatial Card */}
        <div className="lg:col-span-5 w-full flex justify-center">
          <div className="hero-widget w-full max-w-md rounded-2xl border border-border/70 bg-card/60 backdrop-blur-2xl shadow-2xl p-5 relative group overflow-hidden transition-all duration-300 hover:border-foreground/30">
            {/* Top Bar */}
            <div className="flex items-center justify-between pb-4 border-b border-border/50 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 font-mono text-[11px] text-foreground/80">engineer.config.ts</span>
              </div>
              <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
            </div>

            {/* Code Content */}
            <div className="pt-4 font-mono text-xs leading-relaxed space-y-2 text-foreground/90">
              <p className="text-muted-foreground">
                <span className="text-purple-400">const</span> developer = &#123;
              </p>
              <p className="pl-4">
                name: <span className="text-emerald-400">&quot;{PORTFOLIO_DATA.profile.name}&quot;</span>,
              </p>
              <p className="pl-4">
                role: <span className="text-emerald-400">&quot;{PORTFOLIO_DATA.profile.role}&quot;</span>,
              </p>
              <p className="pl-4">
                coreStack: [
                <span className="text-amber-400">&quot;Next.js 16&quot;</span>,{' '}
                <span className="text-amber-400">&quot;React 19&quot;</span>,{' '}
                <span className="text-amber-400">&quot;GSAP 3&quot;</span>
                ],
              </p>
              <p className="pl-4">
                performanceTarget: <span className="text-cyan-400">60</span>, <span className="text-muted-foreground">// FPS</span>
              </p>
              <p className="pl-4">
                passion: <span className="text-purple-400">new</span> Set([<span className="text-emerald-400">&quot;Precision Craft&quot;</span>, <span className="text-emerald-400">&quot;Spatial Physics&quot;</span>]),
              </p>
              <p className="pl-4">
                availableForHire: <span className="text-cyan-400">true</span>
              </p>
              <p className="text-muted-foreground">&#125;;</p>

              {/* Live interactive badges inside widget */}
              <div className="pt-4 border-t border-border/40 grid grid-cols-3 gap-2 text-center text-[10px]">
                <div className="p-2 rounded-lg bg-foreground/[0.03] border border-border/40">
                  <Layers className="w-3.5 h-3.5 mx-auto mb-1 text-indigo-400" />
                  <span className="text-muted-foreground">Clean Arch</span>
                </div>
                <div className="p-2 rounded-lg bg-foreground/[0.03] border border-border/40">
                  <Code2 className="w-3.5 h-3.5 mx-auto mb-1 text-pink-400" />
                  <span className="text-muted-foreground">Zero Slop</span>
                </div>
                <div className="p-2 rounded-lg bg-foreground/[0.03] border border-border/40">
                  <Cpu className="w-3.5 h-3.5 mx-auto mb-1 text-cyan-400" />
                  <span className="text-muted-foreground">High Perf</span>
                </div>
              </div>
            </div>

            {/* Glowing Corner Accent */}
            <div className="absolute -bottom-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 blur-2xl pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Bottom Scroll Prompt */}
      <div className="absolute bottom-4 inset-x-0 flex justify-center items-center pointer-events-none">
        <div className="flex flex-col items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
          <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
            Scroll to Explore
          </span>
          <div className="w-4 h-7 rounded-full border border-muted-foreground/40 flex items-start justify-center p-1">
            <div className="w-1 h-2 rounded-full bg-foreground animate-bounce" />
          </div>
        </div>
      </div>
    </section>
  );
}

