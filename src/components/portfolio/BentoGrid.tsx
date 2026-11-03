'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { PORTFOLIO_DATA } from '@/data/portfolioData';
import {
  Code2,
  Sparkles,
  Palette,
  Cpu,
  Layers,
  Flame,
  CheckCircle2,
  Quote,
} from 'lucide-react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export function BentoGrid() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from('.bento-item', {
        y: 50,
        opacity: 0,
        stagger: 0.1,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        },
      });
    },
    { scope: containerRef }
  );

  return (
    <section id="skills" ref={containerRef} className="py-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full">
      {/* Section Header */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
          <span>02 / ARSENAL & PHILOSOPHY</span>
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
          TECH STACK & CAPABILITIES
        </h2>
        <p className="text-muted-foreground text-sm sm:text-base mt-2 max-w-xl">
          Curated tools and principles honed over 5+ years to ship responsive, pixel-perfect, and ultra-performant software.
        </p>
      </div>

      {/* Bento Grid Container */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Card 1: Core Fullstack (Large 2-column) */}
        <div className="bento-item md:col-span-2 lg:col-span-2 rounded-3xl border border-border/70 bg-card/60 backdrop-blur-xl p-6 sm:p-8 flex flex-col justify-between group hover:border-foreground/30 transition-all duration-300 relative overflow-hidden shadow-sm">
          <div className="space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Modern Fullstack Engineering
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Type-safe architectures designed for scale, maintainability, and clean separation of concerns.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              {PORTFOLIO_DATA.skills.engineering.map((skill, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-foreground/[0.03] border border-border/40 text-xs"
                >
                  <span className="font-medium text-foreground truncate">{skill.name}</span>
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0 ml-1">
                    {skill.level}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-border/40 flex items-center justify-between text-xs font-mono text-muted-foreground">
            <span>Next.js 16 • React 19 • Node.js</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />
        </div>

        {/* Card 2: Creative & Motion Engineering */}
        <div className="bento-item md:col-span-1 lg:col-span-2 rounded-3xl border border-border/70 bg-card/60 backdrop-blur-xl p-6 sm:p-8 flex flex-col justify-between group hover:border-foreground/30 transition-all duration-300 relative overflow-hidden shadow-sm">
          <div className="space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Motion & Spatial Physics
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Choreographing 60fps micro-interactions that make software feel organic, tangible, and alive.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {PORTFOLIO_DATA.skills.creativeMotion.map((skill, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-foreground/[0.04] border border-border/50 text-xs font-mono text-foreground hover:border-purple-500/40 transition-colors"
                >
                  <Flame className="w-3 h-3 text-purple-400" />
                  <span>{skill.name}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-border/40 flex items-center justify-between text-xs font-mono text-muted-foreground">
            <span>GSAP 3 • Lenis • Canvas API</span>
            <span className="text-purple-400">Physics-Driven</span>
          </div>
          <div className="absolute -bottom-10 -right-10 w-36 h-36 rounded-full bg-purple-500/15 blur-2xl pointer-events-none" />
        </div>

        {/* Card 3: Design Systems & Craft */}
        <div className="bento-item md:col-span-1 lg:col-span-2 rounded-3xl border border-border/70 bg-card/60 backdrop-blur-xl p-6 sm:p-8 flex flex-col justify-between group hover:border-foreground/30 transition-all duration-300 relative overflow-hidden shadow-sm">
          <div className="space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-pink-500/10 text-pink-500 flex items-center justify-center">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Design Systems & Tokens
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Translating high-fidelity Figma files into robust, accessible, WCAG 2.2 compliant component libraries.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              {PORTFOLIO_DATA.skills.designSystems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-foreground/90 font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                  <span>{item.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-border/40 text-xs font-mono text-muted-foreground">
            Tailwind CSS v4 • Shadcn UI • OKLCH
          </div>
        </div>

        {/* Card 4: Philosophy & Architecture Quote */}
        <div className="bento-item md:col-span-2 lg:col-span-2 rounded-3xl border border-border/70 bg-gradient-to-br from-card/80 to-foreground/[0.02] backdrop-blur-xl p-6 sm:p-8 flex flex-col justify-between group hover:border-foreground/30 transition-all duration-300 relative overflow-hidden shadow-sm">
          <div className="space-y-4">
            <Quote className="w-8 h-8 text-muted-foreground/30" />
            <blockquote className="text-lg sm:text-xl font-medium tracking-tight text-foreground leading-snug">
              &ldquo;Software craft isn&apos;t just writing code that compiles; it&apos;s having the discipline to make complex systems feel effortlessly simple to the human touching them.&rdquo;
            </blockquote>
          </div>

          <div className="pt-6 mt-6 border-t border-border/40 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center text-[10px] font-bold">
                AN
              </div>
              <span className="font-semibold text-foreground">{PORTFOLIO_DATA.profile.name}</span>
            </div>
            <span className="font-mono text-muted-foreground">Engineering Philosophy</span>
          </div>
        </div>
      </div>
    </section>
  );
}

