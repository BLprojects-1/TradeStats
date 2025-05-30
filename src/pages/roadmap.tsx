import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import Footer from '../components/Footer';

export default function Roadmap() {
  const [copiedCA, setCopiedCA] = useState(false);
  const [visiblePhases, setVisiblePhases] = useState<number[]>([]);
  const [scrollProgress, setScrollProgress] = useState(0);
  const { user } = useAuth();
  const timelineRef = useRef<HTMLDivElement>(null);

  const handleCopyCA = () => {
    const contractAddress = 'EWnHE6JuF1nrih1xZNJBSd6977swuEquuyyrTuLQpump';
    navigator.clipboard.writeText(contractAddress);
    setCopiedCA(true);
    setTimeout(() => setCopiedCA(false), 2000);
  };

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
      statusColor: "text-green-400",
      bgColor: "from-green-600/20 to-emerald-600/20",
      borderColor: "border-green-500/30",
      glowColor: "shadow-green-500/20",
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
      statusColor: "text-indigo-400",
      bgColor: "from-indigo-600/20 to-purple-600/20",
      borderColor: "border-indigo-500/30",
      glowColor: "shadow-indigo-500/20",
      progress: 15,
      items: [
        "🔄 'Add Token' feature for any token watching",
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
      statusColor: "text-purple-400",
      bgColor: "from-purple-600/20 to-pink-600/20",
      borderColor: "border-purple-500/30",
      glowColor: "shadow-purple-500/20",
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
      statusColor: "text-orange-400",
      bgColor: "from-orange-600/20 to-red-600/20",
      borderColor: "border-orange-500/30",
      glowColor: "shadow-orange-500/20",
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
      statusColor: "text-cyan-400",
      bgColor: "from-cyan-600/20 to-blue-600/20",
      borderColor: "border-cyan-500/30",
      glowColor: "shadow-cyan-500/20",
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
    <div className="flex flex-col min-h-screen bg-[#0a0a0f] text-gray-100 relative overflow-hidden">
      <Head>
        <title>Roadmap | ryvu | Solana Trading Journal</title>
        <meta name="description" content="Discover what's next for Ryvu - the future of Solana trading analytics and journaling." />
        <link rel="icon" href="/favicon.png" />
      </Head>

      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-3/4 h-3/4 bg-indigo-900/20 blur-[150px] rounded-full transform -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-2/3 h-2/3 bg-purple-900/10 blur-[120px] rounded-full transform translate-y-1/3 -translate-x-1/4"></div>
      </div>

      <header className="relative z-10 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-indigo-900/20 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex justify-between items-center">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <img src="/logo.png" alt="Ryvu Logo" className="h-6 sm:h-10 w-auto" />
            </Link>
          </div>
          <div className="flex gap-3 sm:gap-6 items-center">
            <div className="hidden sm:flex items-center space-x-3">
              <a 
                href="https://x.com/Ryvujournal" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-900/30 transition-transform hover:scale-110"
                aria-label="Follow us on X (Twitter)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a 
                href="https://axiom.trade/@ryvu" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-900/30 transition-transform hover:scale-110"
                aria-label="View our Axiom profile"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </a>
            </div>
            {user ? (
              <Link 
                href="/dashboard"
                className="px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-md hover:from-indigo-500 hover:to-indigo-400 shadow-lg shadow-indigo-900/30 transition-all duration-300 font-medium"
              >
                Dashboard
              </Link>
            ) : (
              <Link 
                href="/"
                className="px-4 sm:px-5 py-2 sm:py-2.5 text-sm sm:text-base bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-md hover:from-indigo-500 hover:to-indigo-400 shadow-lg shadow-indigo-900/30 transition-all duration-300 font-medium"
              >
                Get Started
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-grow relative z-10">
        {/* Hero Section with Token Info */}
        <section className="relative py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto text-center">
            <div className="mb-12">
              <div className="inline-flex items-center px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-300 text-sm font-medium mb-8">
                <span className="w-2 h-2 bg-indigo-400 rounded-full mr-2 animate-pulse"></span>
                Building the Future of Solana Trading
              </div>
              
              <h1 className="text-5xl sm:text-7xl font-bold leading-tight mb-8">
                <span className="text-white">Ryvu </span>
                <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Roadmap</span>
              </h1>
              
              <p className="text-xl text-gray-300 leading-relaxed max-w-3xl mx-auto mb-12">
                Discover what's next for Ryvu as we transform Solana trading with advanced analytics, 
                community features, and AI-powered insights.
              </p>
            </div>

            {/* Token Information */}
            <div className="bg-gradient-to-br from-[#1a1a2e]/80 to-[#1a1a28]/80 backdrop-blur-sm p-8 rounded-2xl border border-indigo-500/20 shadow-xl shadow-indigo-900/10 max-w-2xl mx-auto mb-16">
              <div className="flex items-center justify-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/30 mr-4">
                  <span className="text-2xl font-bold text-white">$</span>
                </div>
                <div className="text-left">
                  <h3 className="text-2xl font-bold text-white">Ryvu Journal</h3>
                  <p className="text-indigo-300 font-medium">$RYVU Token</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="text-sm text-gray-400 mb-2">Contract Address</div>
                <div 
                  onClick={handleCopyCA}
                  className="bg-[#0a0a0f]/60 rounded-lg p-4 border border-indigo-500/10 cursor-pointer hover:bg-[#0a0a0f]/80 transition-all duration-300 relative group"
                >
                  <div className="font-mono text-sm text-gray-300 break-all group-hover:text-white transition-colors">
                    EWnHE6JuF1nrih1xZNJBSd6977swuEquuyyrTuLQpump
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-[#0a0a0f]/90 rounded-lg">
                    <span className="text-indigo-300 text-sm font-medium">Click to Copy</span>
                  </div>
                  {copiedCA && (
                    <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-3 py-2 rounded-lg text-xs font-medium shadow-lg">
                      Copied!
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Roadmap Timeline */}
        <section className="py-20 relative" ref={timelineRef}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl sm:text-5xl font-bold mb-6 bg-gradient-to-r from-indigo-200 to-indigo-400 bg-clip-text text-transparent">
                The Journey Ahead
              </h2>
              <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                From core trading analytics to AI-powered insights and multi-chain support—here's how we're revolutionizing DeFi trading.
              </p>
            </div>

            <div className="relative">
              {/* Animated Timeline Line */}
              <div className="absolute left-8 top-0 bottom-0 w-1 hidden lg:block">
                {/* Background line */}
                <div className="absolute inset-0 bg-gradient-to-b from-gray-800 via-gray-700 to-gray-800 rounded-full opacity-30"></div>
                {/* Animated progress line */}
                <div 
                  className="absolute top-0 left-0 w-full bg-gradient-to-b from-indigo-500 via-purple-500 to-cyan-500 rounded-full transition-all duration-1000 ease-out"
                  style={{ 
                    height: `${scrollProgress * 100}%`,
                    boxShadow: '0 0 20px rgba(99, 102, 241, 0.5)'
                  }}
                ></div>
                {/* Animated glow effect */}
                <div 
                  className="absolute top-0 left-1/2 w-6 h-6 -translate-x-1/2 bg-indigo-500 rounded-full blur-sm animate-pulse opacity-75"
                  style={{ 
                    top: `${scrollProgress * 100}%`,
                    transition: 'top 1s ease-out'
                  }}
                ></div>
              </div>
              
              <div className="space-y-24">
                {roadmapPhases.map((phase, index) => (
                  <div 
                    key={index} 
                    className="relative"
                    data-phase={index}
                  >
                    {/* Animated Timeline Dot */}
                    <div className={`absolute left-6 w-6 h-6 rounded-full hidden lg:block transition-all duration-500 z-10 ${
                      visiblePhases.includes(index) 
                        ? `bg-gradient-to-r from-indigo-600 to-purple-600 scale-100 ${phase.glowColor} shadow-xl` 
                        : 'bg-gray-600 scale-75'
                    }`}>
                      <div className={`absolute inset-0 rounded-full animate-ping ${
                        visiblePhases.includes(index) && phase.progress > 0 
                          ? 'bg-indigo-400 opacity-75' 
                          : 'opacity-0'
                      }`}></div>
                      {phase.progress === 100 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    <div className="lg:ml-20">
                      <div className={`relative group bg-gradient-to-br ${phase.bgColor} backdrop-blur-sm p-8 rounded-2xl border ${phase.borderColor} shadow-xl ${phase.glowColor} transition-all duration-700 transform ${
                        visiblePhases.includes(index) 
                          ? 'translate-y-0 opacity-100 scale-100' 
                          : 'translate-y-8 opacity-0 scale-95'
                      } hover:scale-[1.02] hover:${phase.glowColor.replace('20', '30')}`}
                      style={{
                        transitionDelay: `${index * 150}ms`
                      }}>
                        
                        {/* Progress bar for in-progress phases */}
                        {phase.progress > 0 && phase.progress < 100 && (
                          <div className="absolute top-0 left-0 right-0 h-1 bg-gray-700 rounded-t-2xl overflow-hidden">
                            <div 
                              className={`h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000 ease-out`}
                              style={{ 
                                width: visiblePhases.includes(index) ? `${phase.progress}%` : '0%',
                                transitionDelay: `${index * 150 + 300}ms`
                              }}
                            ></div>
                          </div>
                        )}

                        {/* Floating particles effect */}
                        <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                          {[...Array(3)].map((_, i) => (
                            <div
                              key={i}
                              className={`absolute w-2 h-2 bg-indigo-400 rounded-full opacity-30 animate-bounce`}
                              style={{
                                left: `${20 + i * 30}%`,
                                top: `${20 + i * 20}%`,
                                animationDelay: `${i * 0.5 + index * 0.2}s`,
                                animationDuration: `${2 + i * 0.5}s`
                              }}
                            ></div>
                          ))}
                        </div>
                        
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 relative z-10">
                          <div className={`transform transition-all duration-500 ${
                            visiblePhases.includes(index) ? 'translate-x-0' : '-translate-x-4'
                          }`} style={{ transitionDelay: `${index * 150 + 200}ms` }}>
                            <div className="flex items-center mb-2">
                              <span className="text-sm font-medium text-indigo-300 mr-3">{phase.phase}</span>
                              <span className={`text-sm font-medium ${phase.statusColor}`}>{phase.status}</span>
                              {phase.progress > 0 && (
                                <span className="ml-3 text-xs bg-gray-700 px-2 py-1 rounded-full">
                                  {phase.progress}%
                                </span>
                              )}
                            </div>
                            <h3 className="text-2xl font-bold text-white">{phase.title}</h3>
                          </div>
                          <div className={`mt-4 sm:mt-0 transform transition-all duration-500 ${
                            visiblePhases.includes(index) ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'
                          }`} style={{ transitionDelay: `${index * 150 + 400}ms` }}>
                            <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${phase.statusColor} bg-current/10 backdrop-blur-sm border border-current/20`}>
                              {phase.status}
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-4 relative z-10">
                          {phase.items.map((item, itemIndex) => {
                            // Properly separate emoji from text content
                            const emojiMatch = item.match(/^(\S+)\s(.+)$/);
                            const emoji = emojiMatch ? emojiMatch[1] : '';
                            const text = emojiMatch ? emojiMatch[2] : item;
                            
                            return (
                              <div 
                                key={itemIndex} 
                                className={`flex items-center space-x-3 transform transition-all duration-500 hover:translate-x-2 hover:bg-white/5 rounded-lg p-2 -m-2 ${
                                  visiblePhases.includes(index) 
                                    ? 'translate-y-0 opacity-100' 
                                    : 'translate-y-4 opacity-0'
                                }`}
                                style={{
                                  transitionDelay: `${index * 150 + 600 + itemIndex * 100}ms`
                                }}
                              >
                                <span className="text-lg flex-shrink-0">{emoji}</span>
                                <span className="text-gray-300 group-hover:text-gray-200 transition-colors">
                                  {text}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Hover glow effect */}
                        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-br from-transparent via-white/5 to-transparent"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Timeline completion indicator */}
              <div className="absolute left-8 -bottom-8 hidden lg:block">
                <div className={`w-6 h-6 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transform transition-all duration-1000 ${
                  scrollProgress > 0.8 ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
                }`}>
                  <div className="absolute inset-0 rounded-full animate-pulse bg-cyan-400 opacity-50"></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Community Section */}
        <section className="py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f] to-[#0f0f1a] pointer-events-none"></div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-16">
              <h2 className="text-4xl sm:text-5xl font-bold mb-6 bg-gradient-to-r from-indigo-200 to-indigo-400 bg-clip-text text-transparent">
                Join the Revolution
              </h2>
              <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                Be part of the community that's shaping the future of Solana trading analytics.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-12 max-w-4xl mx-auto">
              <div className="bg-gradient-to-br from-[#1a1a2e]/80 to-[#1a1a28]/80 backdrop-blur-sm p-8 rounded-2xl border border-indigo-500/20 shadow-xl shadow-indigo-900/10 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-900/30">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Follow Updates</h3>
                <p className="text-gray-300 mb-6">
                  Stay updated with the latest development progress, feature releases, and community news.
                </p>
                <a 
                  href="https://x.com/Ryvujournal" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-lg hover:from-indigo-500 hover:to-indigo-400 shadow-lg shadow-indigo-900/30 transition-all duration-300 font-medium"
                >
                  <span>Follow @Ryvujournal</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>

              <div className="bg-gradient-to-br from-[#1a1a2e]/80 to-[#1a1a28]/80 backdrop-blur-sm p-8 rounded-2xl border border-indigo-500/20 shadow-xl shadow-indigo-900/10 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-900/30">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Join Our Discord</h3>
                <p className="text-gray-300 mb-6">
                  Connect with other traders, get support, and stay updated with the latest developments in our Discord server.
                </p>
                <a 
                  href="https://discord.com/invite/6q7UrFsy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-lg hover:from-purple-500 hover:to-purple-400 shadow-lg shadow-purple-900/30 transition-all duration-300 font-medium"
                >
                  <span>Join Discord</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>

              <div className="bg-gradient-to-br from-[#1a1a2e]/80 to-[#1a1a28]/80 backdrop-blur-sm p-8 rounded-2xl border border-indigo-500/20 shadow-xl shadow-indigo-900/10 text-center md:col-span-2">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-900/30">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Join Our Community Telegram</h3>
                <p className="text-gray-300 mb-6">
                  Join our vibrant Telegram community for real-time updates, trading discussions, and exclusive announcements.
                </p>
                <a 
                  href="https://t.me/+Jq_SuZsXYlI3NWNk" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg hover:from-blue-500 hover:to-cyan-400 shadow-lg shadow-blue-900/30 transition-all duration-300 font-medium"
                >
                  <span>Join Telegram</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 via-purple-900/40 to-pink-900/40 pointer-events-none"></div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="bg-gradient-to-br from-[#1a1a2e]/90 to-[#1a1a28]/90 backdrop-blur-sm p-16 rounded-3xl border border-indigo-500/20 shadow-2xl shadow-indigo-900/20 relative overflow-hidden">
              <div className="max-w-4xl mx-auto text-center relative z-10">
                <h2 className="text-4xl sm:text-6xl font-bold text-white mb-8">
                  The Future of Trading
                  <span className="block bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    Starts Today
                  </span>
                </h2>
                <p className="text-xl text-indigo-100 mb-12 max-w-2xl mx-auto">
                  Don't wait for tomorrow's features. Start building your trading edge with Ryvu's powerful analytics today.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                  <Link 
                    href={user ? "/dashboard" : "/"}
                    className="px-10 py-5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-xl hover:from-indigo-500 hover:to-indigo-400 shadow-xl shadow-indigo-900/30 transform transition-all duration-300 text-lg font-semibold hover:scale-105 flex items-center gap-3 group"
                  >
                    <span>{user ? "Go to Dashboard" : "Start Trading Smarter"}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
} 