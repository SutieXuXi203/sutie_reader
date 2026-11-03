export interface Project {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  year: string;
  description: string;
  tags: string[];
  image: string;
  color: string;
  demoUrl?: string;
  githubUrl?: string;
  metrics?: { label: string; value: string }[];
}

export interface SkillCategory {
  title: string;
  skills: { name: string; level?: string; icon?: string }[];
}

export interface ExperienceItem {
  period: string;
  role: string;
  company: string;
  description: string;
  technologies: string[];
}

export const PORTFOLIO_DATA = {
  profile: {
    name: "Alex Nguyen",
    nickname: "alex.dev",
    role: "Creative Technologist & Fullstack Engineer",
    tagline: "Crafting digital experiences at the intersection of high-end design, motion physics, and resilient system architecture.",
    status: {
      available: true,
      label: "Open to High-Impact Opportunities",
      location: "Vietnam / Remote Worldwide",
    },
    bio: [
      "I bridge the gap between engineering rigor and aesthetic perfection. With 5+ years building production-grade web applications, I focus on ultra-smooth 60fps micro-interactions, responsive architectures, and scalable fullstack backends.",
      "Obsessed with typography, spatial rhythm, and tactile interfaces that feel alive.",
    ],
    stats: [
      { label: "Years Experience", value: "5+" },
      { label: "Completed Projects", value: "30+" },
      { label: "UI / Motion Awards", value: "4" },
      { label: "Client Satisfaction", value: "100%" },
    ],
    socials: {
      github: "https://github.com",
      linkedin: "https://linkedin.com",
      twitter: "https://twitter.com",
      email: "hello@alexnguyen.dev",
    },
  },

  projects: [
    {
      id: "aetheria-os",
      title: "Aetheria OS",
      subtitle: "Spatial Web Operating System",
      category: "Creative Dev / WebGL",
      year: "2026",
      description: "An experimental web-based desktop environment featuring window tiling, fluid physics, simulated file systems, and GSAP-choreographed window transitions.",
      tags: ["Next.js 16", "React 19", "GSAP 3", "Tailwind v4", "Canvas API"],
      image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
      color: "from-cyan-500/20 via-blue-500/10 to-transparent",
      demoUrl: "https://example.com/demo1",
      githubUrl: "https://github.com/example/aetheria",
      metrics: [
        { label: "Performance", value: "60 FPS" },
        { label: "Lighthouse", value: "99/100" },
      ],
    },
    {
      id: "chronos-engine",
      title: "Chronos Canvas",
      subtitle: "Realtime Collaborative Whiteboard",
      category: "Fullstack / Systems",
      year: "2025",
      description: "Infinite collaborative canvas engine built with CRDTs for sub-10ms multiplayer synchronization, spatial audio rooms, and custom hardware-accelerated shaders.",
      tags: ["TypeScript", "WebSockets", "Node.js", "Redis", "Tailwind CSS"],
      image: "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=1200&q=80",
      color: "from-purple-500/20 via-indigo-500/10 to-transparent",
      demoUrl: "https://example.com/demo2",
      githubUrl: "https://github.com/example/chronos",
      metrics: [
        { label: "Sync Latency", value: "< 12ms" },
        { label: "Concurrent Users", value: "10k+" },
      ],
    },
    {
      id: "luminary-luxury",
      title: "Luminary Audio",
      subtitle: "Haute Horlogerie & Acoustics",
      category: "E-Commerce / Awwwards Nominee",
      year: "2025",
      description: "Flagship interactive digital boutique with 3D product viewports, dynamic acoustic visualizer, and tactile sound effects triggered via Web Audio API.",
      tags: ["Next.js", "GSAP ScrollTrigger", "Lenis", "Shadcn UI", "Stripe"],
      image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80",
      color: "from-amber-500/20 via-orange-500/10 to-transparent",
      demoUrl: "https://example.com/demo3",
      githubUrl: "https://github.com/example/luminary",
      metrics: [
        { label: "Conversion Lift", value: "+34%" },
        { label: "Avg Session", value: "4m 12s" },
      ],
    },
    {
      id: "vortex-terminal",
      title: "Vortex Analytics",
      subtitle: "Algorithmic Market Intelligence",
      category: "Fintech / Data Viz",
      year: "2024",
      description: "Institutional-grade financial analytics terminal with customizable widget panels, WebGL orderbook heatmaps, and sub-millisecond price tickers.",
      tags: ["React 19", "D3.js", "Tailwind v4", "Python FastAPI", "TimescaleDB"],
      image: "https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&w=1200&q=80",
      color: "from-emerald-500/20 via-teal-500/10 to-transparent",
      demoUrl: "https://example.com/demo4",
      githubUrl: "https://github.com/example/vortex",
      metrics: [
        { label: "Throughput", value: "50k evt/s" },
        { label: "Uptime", value: "99.99%" },
      ],
    },
  ] as Project[],

  skills: {
    engineering: [
      { name: "TypeScript / JavaScript", level: "Expert" },
      { name: "React 19 / Next.js 16", level: "Expert" },
      { name: "Node.js / Express", level: "Advanced" },
      { name: "PostgreSQL / MongoDB", level: "Advanced" },
      { name: "REST / GraphQL / tRPC", level: "Advanced" },
      { name: "Docker / CI/CD", level: "Proficient" },
    ],
    creativeMotion: [
      { name: "GSAP 3 (ScrollTrigger, Timeline)", level: "Master" },
      { name: "Lenis Smooth Scroll", level: "Master" },
      { name: "Framer Motion / Motion One", level: "Advanced" },
      { name: "Canvas 2D / WebGL Basics", level: "Proficient" },
      { name: "CSS Custom Shaders & Glassmorphism", level: "Master" },
      { name: "Audio Web API Interactivity", level: "Intermediate" },
    ],
    designSystems: [
      { name: "Tailwind CSS v4 (@theme & OKLCH)", level: "Master" },
      { name: "Shadcn UI & Radix Primitives", level: "Master" },
      { name: "Design Tokens & System Architecture", level: "Advanced" },
      { name: "Figma to Code Precision", level: "Master" },
      { name: "WCAG 2.2 Accessibility Compliance", level: "Advanced" },
    ],
  },

  experiences: [
    {
      period: "2024 — PRESENT",
      role: "Lead Creative Technologist",
      company: "Studio Nova",
      description: "Leading frontend engineering and motion choreography for tier-1 tech startups. Engineered reusable interactive component libraries and reduced initial page loads by 45%.",
      technologies: ["Next.js 16", "GSAP", "TypeScript", "Tailwind v4", "WebGL"],
    },
    {
      period: "2022 — 2024",
      role: "Senior Fullstack Engineer",
      company: "Apex Digital Labs",
      description: "Architected high-scale web platforms serving 500k+ monthly active users. Designed real-time collaboration engines and optimized Web Vitals to consistent 95+ scores.",
      technologies: ["React", "Node.js", "PostgreSQL", "Redis", "Docker"],
    },
    {
      period: "2020 — 2022",
      role: "Frontend & UI Engineer",
      company: "Kuro Media",
      description: "Engineered responsive web applications and interactive storyboards. Spearheaded the migration from legacy monolithic views to modern headless component architectures.",
      technologies: ["React", "JavaScript ES6+", "Tailwind CSS", "Figma"],
    },
  ] as ExperienceItem[],
};

