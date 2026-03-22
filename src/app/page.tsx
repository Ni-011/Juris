import React from 'react';

const JurisHero = () => (
  <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden bg-gradient-mesh">
    {/* Decorative Blobs */}
    <div className="absolute top-1/4 -left-20 w-72 h-72 bg-primary/20 rounded-full blur-[100px] animate-pulse" />
    <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-accent/20 rounded-full blur-[100px] animate-pulse delay-1000" />

    <div className="container mx-auto px-6 relative z-10 text-center">
      <div className="inline-block px-4 py-1.5 mb-6 text-sm font-medium tracking-wide text-primary uppercase glass rounded-full">
        The Future of Justice
      </div>
      <h1 className="text-6xl md:text-8xl font-bold mb-8 tracking-tighter leading-none">
        Legal Intelligence <br />
        <span className="text-shimmer">Redefined.</span>
      </h1>
      <p className="max-w-2xl mx-auto text-xl text-slate-400 mb-10 leading-relaxed">
        Juris leverages state-of-the-art neural networks to analyze case law, predict outcomes, and automate document generation for the modern legal firm.
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <button className="px-8 py-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-all shadow-xl shadow-primary/20 hover:scale-105 active:scale-95">
          Request Early Access
        </button>
        <button className="px-8 py-4 glass text-white font-semibold rounded-xl transition-all hover:bg-white/10">
          Watch Showcase
        </button>
      </div>
    </div>
  </section>
);

const FeatureCard = ({ title, description, icon }: { title: string; description: string; icon: string }) => (
  <div className="glass p-8 rounded-2xl glass-hover transition-all duration-300">
    <div className="w-12 h-12 mb-6 bg-primary/20 rounded-lg flex items-center justify-center text-primary text-2xl font-bold">
      {icon}
    </div>
    <h3 className="text-2xl font-bold mb-4">{title}</h3>
    <p className="text-slate-400 leading-relaxed">
      {description}
    </p>
  </div>
);

const JurisServices = () => (
  <section className="py-24 bg-background">
    <div className="container mx-auto px-6">
      <div className="text-center mb-20">
        <h2 className="text-4xl md:text-5xl font-bold mb-6">Expertise at Scale</h2>
        <p className="max-w-xl mx-auto text-slate-400">
          Our platform combines human expertise with algorithmic precision to deliver unmatched legal results.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <FeatureCard
          icon="A"
          title="Case Neural Analysis"
          description="Instant scanning of millions of legal documents to find the needle in the haystack."
        />
        <FeatureCard
          icon="P"
          title="Predictive Analytics"
          description="Data-driven insights on judge behavior and settlement probabilities."
        />
        <FeatureCard
          icon="G"
          title="Generative Drafting"
          description="Automated drafting of complex legal briefs with pinpoint accuracy."
        />
      </div>
    </div>
  </section>
);

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Navbar placeholder */}
      <nav className="fixed top-0 w-full z-50 glass border-x-0 border-t-0 py-4 px-6 flex justify-between items-center">
        <div className="text-2xl font-black tracking-tighter">JURIS.</div>
        <div className="hidden md:flex gap-8 text-sm font-medium text-slate-300">
          <a href="#" className="hover:text-primary transition-colors">Technology</a>
          <a href="#" className="hover:text-primary transition-colors">Solutions</a>
          <a href="#" className="hover:text-primary transition-colors">Security</a>
        </div>
        <button className="px-5 py-2 bg-white text-black text-sm font-bold rounded-lg hover:bg-slate-200 transition-colors">
          Contact
        </button>
      </nav>

      <JurisHero />
      <JurisServices />

      {/* Footer */}
      <footer className="py-12 border-t border-white/10 bg-background text-center text-slate-500 text-sm">
        <div className="mb-4 text-foreground font-bold tracking-tighter">JURIS.</div>
        <p>&copy; 2026 Juris AI Technologies. All rights reserved.</p>
      </footer>
    </main>
  );
}
