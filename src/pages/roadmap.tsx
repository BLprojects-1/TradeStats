import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';

export default function Roadmap() {
  const [visiblePhases, setVisiblePhases] = useState<number[]>([]);
  const [scrollProgress, setScrollProgress] = useState(0);
  const { user } = useAuth();
  const timelineRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for staggered animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const phaseIndex = parseInt(entry.target.getAttribute('data-phase') || '0');
            setVisiblePhases((prev) => {
              if (!prev.includes(phaseIndex)) {
                return [...prev, phaseIndex].sort((a, b) => a - b);
              }
              return prev;
            });
          }
        });
      },
      { threshold: 0.3 }
    );

    const phaseElements = document.querySelectorAll('[data-phase]');
    phaseElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  // Scroll progress for timeline
  useEffect(() => {
    const handleScroll = () => {
      if (timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const elementHeight = rect.height;
        
        let progress = 0;
        if (rect.top < windowHeight && rect.bottom > 0) {
          progress = Math.min(1, Math.max(0, (windowHeight - rect.top) / (windowHeight + elementHeight)));
        }
        
        setScrollProgress(progress);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial call
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const roadmapPhases = [
    {
      phase: "Phase 1",
      title: "Foundation & Core Analytics",
      status: "Completed",
      statusColor: "text-emerald-400",
      bgColor: "from-emerald-600 to-teal-600",
      borderColor: "border-emerald-500/30",
      glowColor: "shadow-emerald-500/30",
      progress: 100,
      items: [
        "✅ Real-time open positions & 24h performance metrics",
        "✅ Deep performance analysis (best/worst trades)",
        "✅ Custom trade checklist with Yes/No questions",
        "✅ Up to 3 wallet tracking capability",
        "✅ Win rate tracking & faded runners identification",
        "✅ Completely free platform (transaction fee funded)"
      ]
    },
    {
      phase: "Phase 2",
      title: "Platform Enhancement & Optimization",
      status: "In Progress",
      statusColor: "text-teal-400",
      bgColor: "from-teal-600 to-amber-600",
      borderColor: "border-teal-500/30",
      glowColor: "shadow-teal-500/30",
      progress: 15,
      items: [
        "✅ 'Add Token' feature for any token watching",
        "🔄 Improved scan times for larger wallets",
        "🔄 Complete dashboard UI revamp",
        "⏳ API infrastructure upgrades",
        "⏳ Enhanced checklist functionality",
        "⏳ Performance optimization across platform"
      ]
    },
    {
      phase: "Phase 3",
      title: "Token Gating & Community Rewards",
      status: "Planned",
      statusColor: "text-amber-400",
      bgColor: "from-amber-600 to-emerald-600",
      borderColor: "border-amber-500/30",
      glowColor: "shadow-amber-500/30",
      progress: 0,
      items: [
        "🔐 Holder-only platform access & gating",
        "🏆 Weekly profitability leaderboards",
        "💰 Reward system for top & bottom performers",
        "📊 Enhanced analytics for token holders",
        "🎯 Limited access for non-holders",
        "⭐ Token utility & holder benefits"
      ]
    },
    {
      phase: "Phase 4",
      title: "Advanced AI & Full History",
      status: "Planned",
      statusColor: "text-emerald-400",
      bgColor: "from-emerald-600 to-teal-600",
      borderColor: "border-emerald-500/30",
      glowColor: "shadow-emerald-500/30",
      progress: 0,
      items: [
        "🤖 AI-powered trade analysis & recommendations",
        "📈 Full trading history import (beyond 24h)",
        "🧠 Personalized risk management suggestions",
        "🔗 Shared trading strategies marketplace",
        "📋 Strategy performance tracking & rewards",
        "🔍 Pattern recognition & success probability"
      ]
    },
    {
      phase: "Phase 5",
      title: "Multi-Chain & Browser Extension",
      status: "Planned",
      statusColor: "text-teal-400",
      bgColor: "from-teal-600 to-amber-600",
      borderColor: "border-teal-500/30",
      glowColor: "shadow-teal-500/30",
      progress: 0,
      items: [
        "🌐 Ethereum & BNB chain integration",
        "🔔 Browser extension with checklist alerts",
        "⚡ Cross-chain portfolio aggregation",
        "🚀 Multi-chain trading analytics",
        "📱 Mobile app development",
        "🌍 Global trader community features"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-950 text-white relative overflow-x-hidden">
      <Head>
        <title>Roadmap | TICKR | Professional Solana Trading Analytics</title>
        <meta name="description" content="Discover TICKR's professional development roadmap - institutional-grade trading analytics features and enterprise platform evolution." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.png" />
      </Head>

      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-amber-500/5 rounded-full blur-2xl"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 bg-slate-950/50 backdrop-blur-xl border-b border-emerald-500/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 transform scale-120 origin-center">
          <div className="flex justify-between items-center py-8">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <img 
                src="/logo.png" 
                alt="TICKR Logo" 
                className="h-12 w-auto"
              />
            </Link>

            {/* Navigation */}
            <div className="flex items-center space-x-8">
              {/* Social Links */}
              <div className="hidden md:flex items-center space-x-4">
                <a 
                  href="https://x.com/TICKRjournal" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:scale-110 hover:shadow-emerald-500/30"
                  aria-label="Follow us on X (Twitter)"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <a 
                  href="https://t.me/+Jq_SuZsXYlI3NWNk" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:scale-110 hover:shadow-emerald-500/30"
                  aria-label="Join our Telegram channel"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                </a>
                <a 
                  href="https://discord.gg/6q7UrFsy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:scale-110 hover:shadow-emerald-500/30"
                  aria-label="Join our Discord server"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                </a>
              </div>

              {/* Auth Buttons */}
              <div className="flex items-center space-x-6">
                <Link 
                  href={user ? "/dashboard" : "/"} 
                  className="px-6 py-3 text-emerald-300 hover:text-emerald-200 font-medium transition-colors text-lg"
                >
                  {user ? "Dashboard" : "Home"}
                </Link>
                <Link 
                  href={user ? "/dashboard" : "/"} 
                  className="px-8 py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-amber-600 text-white rounded-xl shadow-lg shadow-emerald-500/30 hover:from-emerald-500 hover:via-teal-500 hover:to-amber-500 transition-all duration-300 transform hover:scale-105 font-medium text-lg"
                >
                  {user ? "Go to Dashboard" : "Get Started"}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto transform scale-120 origin-center">
            <div className="text-center">
              {/* Badge */}
              <div className="inline-flex items-center px-6 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-300 text-base font-medium mb-10">
                <span className="w-3 h-3 bg-emerald-400 rounded-full mr-3 animate-pulse"></span>
                Professional Platform Development
              </div>

              {/* Main Heading */}
              <h1 className="text-6xl md:text-8xl font-bold mb-8">
                <span className="bg-gradient-to-r from-emerald-300 via-teal-300 to-amber-300 bg-clip-text text-transparent">
                  Platform
                </span>
                <br />
                <span className="text-white">Roadmap</span>
              </h1>

              {/* Subtitle */}
              <p className="text-2xl md:text-3xl text-slate-300 mb-16 max-w-5xl mx-auto leading-relaxed">
                Discover our systematic approach to building the most advanced Solana trading analytics platform. 
                Each phase delivers enterprise-grade features for professional traders.
              </p>
              
              {/* Progress Overview */}
              <div className="grid md:grid-cols-3 gap-10 mb-20">
                <div className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 to-teal-600/10 opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500 rounded-2xl"></div>
                  <div className="relative bg-slate-900/50 backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-10 transition-all duration-300 hover:border-emerald-500/50">
                    <div className="w-20 h-20 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-emerald-500/30">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4">Phase 1</h3>
                    <p className="text-emerald-400 font-semibold text-lg mb-3">Completed</p>
                    <p className="text-slate-300 text-lg">Core analytics foundation deployed</p>
                  </div>
                </div>
                
                <div className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-teal-600/10 to-amber-600/10 opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500 rounded-2xl"></div>
                  <div className="relative bg-slate-900/50 backdrop-blur-xl border border-teal-500/30 rounded-2xl p-10 transition-all duration-300 hover:border-teal-500/50">
                    <div className="w-20 h-20 bg-gradient-to-br from-teal-600 to-amber-600 rounded-xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-teal-500/30">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4">Phase 2</h3>
                    <p className="text-teal-400 font-semibold text-lg mb-3">In Progress</p>
                    <p className="text-slate-300 text-lg">Platform optimization & enhancement</p>
                  </div>
                </div>
                
                <div className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-600/10 to-emerald-600/10 opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500 rounded-2xl"></div>
                  <div className="relative bg-slate-900/50 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-10 transition-all duration-300 hover:border-amber-500/50">
                    <div className="w-20 h-20 bg-gradient-to-br from-amber-600 to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-amber-500/30">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4">Phases 3-5</h3>
                    <p className="text-amber-400 font-semibold text-lg mb-3">Planned</p>
                    <p className="text-slate-300 text-lg">Advanced features & multi-chain expansion</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Timeline Section */}
        <section className="py-24 px-4 sm:px-6 lg:px-8" ref={timelineRef}>
          <div className="max-w-6xl mx-auto transform scale-120 origin-center">
            <div className="relative">
              {/* Progress Line */}
              <div className="absolute left-8 top-0 w-1 h-full bg-slate-700 rounded-full">
                <div 
                  className="w-full bg-gradient-to-b from-emerald-400 via-teal-400 to-amber-400 transition-all duration-1000 ease-out rounded-full"
                  style={{ height: `${scrollProgress * 100}%` }}
                ></div>
              </div>

              {/* Roadmap Phases */}
              <div className="space-y-20">
                {roadmapPhases.map((phase, index) => (
                  <div
                    key={index}
                    data-phase={index}
                    className={`relative flex items-start space-x-12 transition-all duration-700 ${
                      visiblePhases.includes(index) 
                        ? 'translate-x-0 opacity-100' 
                        : 'translate-x-8 opacity-0'
                    }`}
                    style={{ transitionDelay: `${index * 200}ms` }}
                  >
                    {/* Timeline Dot */}
                    <div className="relative flex-shrink-0">
                      <div className={`w-16 h-16 rounded-full border-4 border-slate-950 bg-gradient-to-br ${phase.bgColor} shadow-xl ${phase.glowColor} flex items-center justify-center`}>
                        <span className="text-white font-bold text-lg">{index + 1}</span>
                      </div>
                    </div>

                    {/* Phase Content */}
                    <div className="flex-grow">
                      <div className={`bg-slate-900/50 backdrop-blur-xl border ${phase.borderColor} rounded-3xl p-10 hover:border-opacity-60 transition-all duration-300 shadow-2xl ${phase.glowColor}`}>
                        <div className="flex justify-between items-start mb-8">
                          <div>
                            <div className="flex items-center space-x-6 mb-4">
                              <h3 className="text-3xl font-bold text-white">{phase.phase}</h3>
                              <span className={`px-4 py-2 rounded-full text-base font-semibold border ${phase.statusColor} border-current/20 bg-current/10`}>
                                {phase.status}
                              </span>
                            </div>
                            <h4 className="text-2xl text-slate-300 font-medium">{phase.title}</h4>
                          </div>
                          {phase.progress > 0 && (
                            <div className="text-right">
                              <div className={`text-3xl font-bold ${phase.statusColor} mb-2`}>{phase.progress}%</div>
                              <div className="w-32 h-3 bg-slate-700 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full bg-gradient-to-r ${phase.bgColor} transition-all duration-1000 ease-out`}
                                  style={{ 
                                    width: visiblePhases.includes(index) ? `${phase.progress}%` : '0%',
                                    transitionDelay: `${index * 200 + 500}ms`
                                  }}
                                ></div>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="grid lg:grid-cols-2 gap-6">
                          {phase.items.map((item, itemIndex) => (
                            <div
                              key={itemIndex}
                              className="flex items-start space-x-4 p-4 rounded-xl bg-slate-800/30 hover:bg-slate-800/50 transition-colors border border-slate-700/30"
                            >
                              <span className="text-xl flex-shrink-0">{item.split(' ')[0]}</span>
                              <span className="text-slate-300 text-base font-medium">{item.substring(item.indexOf(' ') + 1)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action Section */}
        <section className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto text-center transform scale-120 origin-center">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 blur-3xl rounded-3xl"></div>
              <div className="relative bg-slate-900/50 backdrop-blur-xl border border-emerald-500/30 rounded-3xl p-16">
                <h2 className="text-4xl md:text-6xl font-bold mb-8 text-white">
                  Shape the Future of Professional Trading Analytics
                </h2>
                <p className="text-2xl text-slate-300 mb-12 max-w-3xl mx-auto">
                  Join our community of professional traders and help influence the development of enterprise-grade features. Your feedback drives our roadmap.
                </p>
                <div className="flex flex-col sm:flex-row gap-6 justify-center">
                  <Link 
                    href={user ? "/dashboard" : "/"} 
                    className="px-10 py-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-amber-600 text-white rounded-xl shadow-xl shadow-emerald-500/30 hover:from-emerald-500 hover:via-teal-500 hover:to-amber-500 transition-all duration-300 transform hover:scale-105 font-semibold text-xl"
                  >
                    {user ? "Access Dashboard" : "Start Now"}
                  </Link>
                  <a 
                    href="https://discord.gg/6q7UrFsy" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-10 py-5 border border-emerald-500/30 text-emerald-300 rounded-xl hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all duration-300 font-semibold text-xl"
                  >
                    Join Community
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 bg-slate-950/50 backdrop-blur-xl border-t border-emerald-500/20 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 transform scale-120 origin-center">
          <div className="text-center">
            <p className="text-slate-400 text-lg">
              © 2024 TICKR. Built for professional Solana traders.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
} 