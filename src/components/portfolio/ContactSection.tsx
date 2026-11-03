'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PORTFOLIO_DATA } from '@/data/portfolioData';
import {
  Mail,
  Copy,
  Check,
  Github,
  Linkedin,
  Twitter,
  ArrowUpRight,
  Clock,
  Send,
  MessageSquare,
} from 'lucide-react';

export function ContactSection() {
  const [copied, setCopied] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [formSent, setFormSent] = useState(false);
  const [formState, setFormState] = useState({ name: '', email: '', message: '' });

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      // Formatted in ICT (UTC+7)
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      };
      setCurrentTime(new Intl.DateTimeFormat('en-US', options).format(now));
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(PORTFOLIO_DATA.profile.socials.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name || !formState.email || !formState.message) return;
    setFormSent(true);
    setTimeout(() => {
      setFormState({ name: '', email: '', message: '' });
      setFormSent(false);
    }, 4000);
  };

  return (
    <section id="contact" className="py-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full border-t border-border/50">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
          <span>04 / CONNECT</span>
        </div>
        <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
          LET&apos;S BUILD THE FUTURE TOGETHER
        </h2>
        <p className="text-muted-foreground text-sm sm:text-base mt-4">
          Have an exciting project, leadership role, or creative collaboration in mind? My inbox is always open.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Contact Cards & Direct Email */}
        <div className="lg:col-span-5 space-y-6">
          {/* Email Copy Card */}
          <div className="rounded-3xl border border-border/70 bg-card/60 backdrop-blur-xl p-6 sm:p-8 space-y-4 shadow-sm">
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Direct Contact
            </span>
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-foreground/[0.04] border border-border/60">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-mono font-medium text-foreground truncate">
                  {PORTFOLIO_DATA.profile.socials.email}
                </span>
              </div>
              <button
                onClick={handleCopyEmail}
                className="shrink-0 p-2 rounded-xl bg-foreground text-background hover:opacity-90 active:scale-95 transition-all text-xs font-medium flex items-center gap-1.5"
                data-cursor-pointer
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Timezone & Location Widget */}
            <div className="flex items-center justify-between pt-4 border-t border-border/40 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span>Vietnam (UTC+7)</span>
              </div>
              <span className="font-mono font-semibold text-foreground">{currentTime || '09:00:00 AM'}</span>
            </div>
          </div>

          {/* Social Profiles Grid */}
          <div className="rounded-3xl border border-border/70 bg-card/60 backdrop-blur-xl p-6 space-y-3 shadow-sm">
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Online Presences
            </span>
            <div className="grid grid-cols-3 gap-3 pt-1">
              <Link
                href={PORTFOLIO_DATA.profile.socials.github}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-foreground/[0.03] border border-border/50 hover:border-foreground/30 hover:bg-foreground/[0.06] transition-all group"
                data-cursor-pointer
              >
                <Github className="w-5 h-5 text-foreground group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">GitHub</span>
              </Link>
              <Link
                href={PORTFOLIO_DATA.profile.socials.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-foreground/[0.03] border border-border/50 hover:border-foreground/30 hover:bg-foreground/[0.06] transition-all group"
                data-cursor-pointer
              >
                <Linkedin className="w-5 h-5 text-foreground group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">LinkedIn</span>
              </Link>
              <Link
                href={PORTFOLIO_DATA.profile.socials.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-foreground/[0.03] border border-border/50 hover:border-foreground/30 hover:bg-foreground/[0.06] transition-all group"
                data-cursor-pointer
              >
                <Twitter className="w-5 h-5 text-foreground group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">Twitter</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Right Side: Quick Message Form */}
        <div className="lg:col-span-7 rounded-3xl border border-border/70 bg-card/60 backdrop-blur-xl p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            <h3 className="text-lg font-bold tracking-tight text-foreground">
              Send a Direct Dispatch
            </h3>
          </div>

          {formSent ? (
            <div className="p-8 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto">
                <Check className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-foreground">Message Dispatched!</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Thank you for reaching out. I will review your message and reply within 24 hours.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Jane Doe"
                    value={formState.name}
                    onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-foreground/[0.03] border border-border/60 text-foreground text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="jane@company.com"
                    value={formState.email}
                    onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-foreground/[0.03] border border-border/60 text-foreground text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Project Brief or Message
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Tell me about your project, timeline, and deliverables..."
                  value={formState.message}
                  onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-foreground/[0.03] border border-border/60 text-foreground text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-foreground text-background font-semibold text-sm hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-md shadow-foreground/10"
                data-cursor-pointer
              >
                <span>Transmit Message</span>
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

