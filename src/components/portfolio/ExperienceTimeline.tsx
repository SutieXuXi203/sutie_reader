'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { PORTFOLIO_DATA } from '@/data/portfolioData';
import { Briefcase, Calendar } from 'lucide-react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export function ExperienceTimeline() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from('.timeline-card', {
        x: -30,
        opacity: 0,
        stagger: 0.15,
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
    <section id="experience" ref={containerRef} className="py-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full border-t border-border/50">
      {/* Section Header */}
      <div className="mb-14">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
          <span>03 / THE JOURNEY</span>
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
          WORK EXPERIENCE
        </h2>
        <p className="text-muted-foreground text-sm sm:text-base mt-2">
          A track record of engineering leadership, scalable product delivery, and technical innovation.
        </p>
      </div>

      {/* Timeline items */}
      <div className="relative border-l-2 border-border/60 ml-4 sm:ml-6 pl-6 sm:pl-10 space-y-12">
        {PORTFOLIO_DATA.experiences.map((exp, idx) => (
          <div key={idx} className="timeline-card relative group">
            {/* Timeline bullet beacon */}
            <div className="absolute -left-[31px] sm:-left-[47px] top-1.5 w-3.5 h-3.5 rounded-full bg-background border-2 border-foreground group-hover:scale-125 group-hover:border-indigo-500 transition-all duration-300">
              {idx === 0 && (
                <span className="absolute -inset-1 rounded-full bg-indigo-500/40 animate-ping" />
              )}
            </div>

            {/* Content card */}
            <div className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-xl p-6 sm:p-7 shadow-sm transition-all duration-300 hover:border-foreground/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                    {exp.role}
                  </h3>
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mt-0.5">
                    <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{exp.company}</span>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-muted-foreground px-3 py-1 rounded-full bg-foreground/[0.04] border border-border/40 w-max">
                  <Calendar className="w-3 h-3 text-muted-foreground" />
                  <span>{exp.period}</span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">
                {exp.description}
              </p>

              {/* Technologies used */}
              <div className="flex flex-wrap gap-1.5 pt-4 mt-4 border-t border-border/40">
                {exp.technologies.map((tech) => (
                  <span
                    key={tech}
                    className="px-2.5 py-0.5 rounded-md bg-foreground/[0.03] border border-border/50 text-[11px] font-mono text-muted-foreground"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

