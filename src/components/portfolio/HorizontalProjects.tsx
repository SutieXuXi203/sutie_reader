'use client';

import { useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { PORTFOLIO_DATA } from '@/data/portfolioData';
import { ExternalLink, Github, ArrowRight } from 'lucide-react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export function HorizontalProjects() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      // Desktop & Tablet: Horizontal pinning scroll
      mm.add('(min-width: 768px)', () => {
        const track = trackRef.current;
        const section = sectionRef.current;
        if (!track || !section) return;

        const totalScrollWidth = track.scrollWidth - window.innerWidth + 120;

        const tween = gsap.to(track, {
          x: -totalScrollWidth,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            pin: true,
            scrub: 1,
            start: 'top top',
            end: () => `+=${totalScrollWidth}`,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              if (progressBarRef.current) {
                gsap.set(progressBarRef.current, { scaleX: self.progress });
              }
            },
          },
        });

        // Parallax image movement inside cards
        gsap.utils.toArray<HTMLElement>('.project-image').forEach((img) => {
          gsap.fromTo(
            img,
            { scale: 1.15, x: 20 },
            {
              scale: 1,
              x: -20,
              ease: 'none',
              scrollTrigger: {
                trigger: section,
                start: 'top top',
                end: () => `+=${totalScrollWidth}`,
                scrub: 1,
              },
            }
          );
        });

        return () => {
          tween.kill();
        };
      });

      // Mobile: Vertical layout with entry reveals
      mm.add('(max-width: 767px)', () => {
        gsap.utils.toArray<HTMLElement>('.project-card').forEach((card) => {
          gsap.from(card, {
            y: 40,
            opacity: 0,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 85%',
              toggleActions: 'play none none reverse',
            },
          });
        });
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      id="projects"
      ref={sectionRef}
      className="relative bg-background overflow-hidden border-t border-border/50 select-none py-16 md:py-0 md:h-screen md:flex md:flex-col md:justify-center"
    >
      {/* Section Header */}
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 mb-8 md:mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
            <span>01 / CASE STUDIES</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            SELECTED WORKS
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-sm">
          A showcase of interactive platforms, WebGL engines, and enterprise apps engineered for fluid performance.
        </p>
      </div>

      {/* Horizontal Track (for Desktop) / Vertical Stack (for Mobile) */}
      <div
        ref={trackRef}
        className="flex flex-col md:flex-row gap-6 md:gap-8 px-4 sm:px-6 lg:px-8 w-full md:w-max md:pl-[calc((100vw-72rem)/2+2rem)] will-change-transform"
      >
        {PORTFOLIO_DATA.projects.map((project, idx) => (
          <div
            key={project.id}
            className="project-card relative w-full md:w-[620px] lg:w-[700px] shrink-0 rounded-3xl border border-border/70 bg-card/70 backdrop-blur-xl overflow-hidden group transition-all duration-300 hover:border-foreground/30 shadow-xl"
            data-cursor-project="EXPLORE"
          >
            {/* Visual Preview Container */}
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted/40">
              <Image
                src={project.image}
                alt={project.title}
                fill
                sizes="(max-width: 768px) 100vw, 700px"
                className="project-image object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                priority={idx === 0}
              />
              {/* Gradient Overlay */}
              <div className={`absolute inset-0 bg-gradient-to-t ${project.color}`} />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />

              {/* Category & Year Tag */}
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-background/80 backdrop-blur-md text-[11px] font-mono tracking-wider text-foreground border border-border/60">
                  {project.category}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-background/60 backdrop-blur-md text-[11px] font-mono text-muted-foreground border border-border/40">
                  {project.year}
                </span>
              </div>

              {/* Metrics Pills (Top Right) */}
              {project.metrics && (
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  {project.metrics.map((m, mIdx) => (
                    <div
                      key={mIdx}
                      className="px-2.5 py-1 rounded-full bg-background/80 backdrop-blur-md border border-border/60 text-right"
                    >
                      <span className="text-[10px] text-muted-foreground mr-1.5">{m.label}:</span>
                      <span className="text-[11px] font-mono font-semibold text-foreground">{m.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Card Content & Details */}
            <div className="p-6 sm:p-8 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground group-hover:text-primary transition-colors">
                    {project.title}
                  </h3>
                  <p className="text-sm font-medium text-muted-foreground mt-0.5">
                    {project.subtitle}
                  </p>
                </div>

                {/* External Action Links */}
                <div className="flex items-center gap-2 shrink-0">
                  {project.githubUrl && (
                    <Link
                      href={project.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-full border border-border bg-background/80 hover:bg-foreground hover:text-background text-foreground transition-all"
                      aria-label="View source code on GitHub"
                      data-cursor-pointer
                    >
                      <Github className="w-4 h-4" />
                    </Link>
                  )}
                  {project.demoUrl && (
                    <Link
                      href={project.demoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-foreground text-background text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
                      data-cursor-pointer
                    >
                      <span>Live Demo</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                {project.description}
              </p>

              {/* Technologies Badges */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-md bg-foreground/[0.04] border border-border/50 text-[11px] font-mono text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Progress Bar Indicator */}
      <div className="hidden md:block max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-6">
        <div className="h-1 w-full bg-border/40 rounded-full overflow-hidden">
          <div
            ref={progressBarRef}
            className="h-full w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 origin-left scale-x-0"
            style={{ willChange: 'transform' }}
          />
        </div>
      </div>
    </section>
  );
}

