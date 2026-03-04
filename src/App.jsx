import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Moon, Sun, Wind, Settings2, Share2, Quote, Heart, Lock, Award, TrendingUp, Mail, ShieldCheck, ChevronRight, CheckCircle2, CreditCard } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

// Firebase configuration placeholder
const firebaseConfig = {
  apiKey: "API_KEY",
  authDomain: "PROJECT_ID.firebaseapp.com",
  projectId: "PROJECT_ID",
  storageBucket: "PROJECT_ID.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'memento-mori-final';

// --- PRODUCTION STRIPE LINK ---
const STRIPE_CHECKOUT_URL = "https://buy.stripe.com/4gMcN7cwc8g4cN36Dk0VO01";

const App = () => {
  const [setup, setSetup] = useState({
    birthDate: '',
    expectancy: 84,
    name: '',
    isPremium: false
  });
  const [user, setUser] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [viewMode, setViewMode] = useState('days');
  const [pulse, setPulse] = useState(1);
  const [activeTab, setActiveTab] = useState('timer');
  const [showPaywall, setShowPaywall] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 1. Authentication and Data Recovery
  useEffect(() => {
    const initAuth = async () => {
      // For demo, we just sign in anonymously
      await signInAnonymously(auth);
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const docRef = doc(db, 'artifacts', appId, 'users', u.uid, 'settings', 'profile');
        const docSnap = await getDoc(docRef);

        // Check for payment success parameter in URL
        const params = new URLSearchParams(window.location.search);
        const hasPaymentSucceeded = params.get('payment_success') === 'true';

        if (docSnap.exists()) {
          let userData = docSnap.data();
          if (hasPaymentSucceeded && !userData.isPremium) {
            // Upgrade user to premium immediately after return from Stripe
            await updateDoc(docRef, { isPremium: true });
            userData.isPremium = true;
            // Clean the URL to prevent re-triggering logic on refresh
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          setSetup(userData);
          setIsLive(true);
        } else if (hasPaymentSucceeded) {
          // If profile doesn't exist but payment is confirmed, we initialize with defaults as premium
          const newProfile = { ...setup, isPremium: true };
          await setDoc(docRef, newProfile);
          setSetup(newProfile);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time Calculation Engine
  const calculateAll = useCallback(() => {
    if (!setup.birthDate) return null;
    const now = new Date();
    const birth = new Date(setup.birthDate);
    const death = new Date(birth);
    death.setFullYear(birth.getFullYear() + parseInt(setup.expectancy));

    const remainingMs = death.getTime() - now.getTime();
    if (remainingMs <= 0) return { expired: true };

    const totalMs = death.getTime() - birth.getTime();
    const elapsedMs = now.getTime() - birth.getTime();

    return {
      ms: remainingMs,
      percent: (elapsedMs / totalMs) * 100,
      years: Math.floor(remainingMs / (365.25 * 24 * 60 * 60 * 1000)),
      days: Math.floor(remainingMs / (24 * 60 * 60 * 1000)),
      hours: Math.floor((remainingMs / (60 * 60 * 1000)) % 24),
      minutes: Math.floor((remainingMs / (60 * 1000)) % 60),
      seconds: Math.floor((remainingMs / 1000) % 60),
      milli: Math.floor((remainingMs % 1000) / 10),
      breaths: Math.floor(remainingMs / 4000),
      expired: false
    };
  }, [setup]);

  useEffect(() => {
    if (isLive) {
      const timer = setInterval(() => {
        const result = calculateAll();
        if (result?.expired) {
          setIsLive(false);
          clearInterval(timer);
        } else {
          setTimeLeft(result);
          setPulse(1 + (Math.sin(Date.now() / 800) * 0.025));
        }
      }, 40);
      return () => clearInterval(timer);
    }
  }, [isLive, calculateAll]);

  const handleInitialize = async (e) => {
    e.preventDefault();
    if (user) {
      try {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile');
        await setDoc(docRef, setup);
      } catch (err) {
        console.warn("Failed to save to Firebase, continuing locally:", err);
      }
    }
    setIsLive(true);
  };

  const handlePurchase = () => {
    setIsProcessing(true);
    window.location.href = STRIPE_CHECKOUT_URL;
  };

  if (!isLive) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 text-neutral-300 selection:bg-white selection:text-black">
        <div className="max-w-md w-full space-y-12 animate-in fade-in duration-1000">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-light tracking-[0.5em] text-white">MEMENTO MORI</h1>
            <p className="text-neutral-600 text-[10px] tracking-[0.4em] uppercase">Time is the only asset</p>
          </div>
          <form onSubmit={handleInitialize} className="space-y-8">
            <div className="space-y-6">
              <div className="border-b border-neutral-800 pb-2 focus-within:border-white transition-colors">
                <label className="block text-[9px] uppercase tracking-widest text-neutral-600 mb-2">Date of Birth</label>
                <input
                  type="date"
                  required
                  className="bg-transparent w-full outline-none text-xl font-light text-white [color-scheme:dark]"
                  value={setup.birthDate}
                  onChange={e => setSetup({ ...setup, birthDate: e.target.value })}
                />
              </div>
              <div className="border-b border-neutral-800 pb-2 focus-within:border-white transition-colors">
                <label className="block text-[9px] uppercase tracking-widest text-neutral-600 mb-2">Expectancy Age</label>
                <input
                  type="number"
                  className="bg-transparent w-full outline-none text-xl font-light text-white"
                  value={setup.expectancy}
                  onChange={e => setSetup({ ...setup, expectancy: e.target.value })}
                />
              </div>
            </div>
            <button className="w-full py-5 bg-white text-black text-[10px] font-bold uppercase tracking-[0.4em] rounded-xl hover:scale-[0.99] active:scale-95 transition-all">
              Launch Engine
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Safety guard for rendering
  if (!timeLeft) return null;

  return (
    <div className="min-h-screen bg-black text-neutral-400 font-light flex flex-col selection:bg-white selection:text-black">
      {/* Background Pulse */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none opacity-20">
        <div
          className="w-[85vw] h-[85vw] border border-white rounded-full transition-transform"
          style={{ transform: `scale(${pulse})` }}
        />
      </div>

      {/* Persistent Header */}
      <header className="p-8 flex justify-between items-center relative z-40">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.5)]" />
          <span className="text-[10px] font-bold tracking-[0.4em] text-white">LIFE PULSE ACTIVE</span>
        </div>
        <div className="flex gap-4">
          {!setup.isPremium ? (
            <button
              onClick={() => setShowPaywall(true)}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-full text-[10px] font-bold tracking-widest text-white hover:border-neutral-500 transition-all"
            >
              <Award size={14} className="text-amber-500" /> UPGRADE
            </button>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-emerald-900/30 rounded-full text-[10px] font-bold tracking-widest text-emerald-400">
              <CheckCircle2 size={14} /> PREMIUM
            </div>
          )}
          <button
            onClick={() => setIsLive(false)}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-neutral-900 hover:text-white transition-all"
          >
            <Settings2 size={16} />
          </button>
        </div>
      </header>

      {/* View Selector */}
      <nav className="flex justify-center gap-10 mb-12 text-[9px] font-bold tracking-[0.4em] uppercase relative z-30">
        {['timer', 'legacy', 'insight'].map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`transition-all ${activeTab === t ? 'text-white border-b border-white pb-2' : 'text-neutral-700 hover:text-neutral-500'}`}
          >
            {t}
          </button>
        ))}
      </nav>

      {/* Main Experience Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-20">
        {activeTab === 'timer' && (
          <div className="text-center space-y-20 animate-in fade-in zoom-in duration-1000">
            <div onClick={() => setViewMode(v => v === 'days' ? 'percentage' : 'days')} className="cursor-pointer group">
              <div className="text-8xl md:text-[11rem] font-extralight text-white tabular-nums tracking-tighter leading-none">
                {viewMode === 'days' ? (timeLeft.days?.toLocaleString() ?? '---') : (timeLeft.percent?.toFixed(6) + '%')}
              </div>
              <p className="text-[10px] tracking-[0.7em] mt-8 opacity-30 uppercase group-hover:opacity-70 transition-opacity">
                {viewMode === 'days' ? 'Days to Dust' : 'Burned Life Progress'}
              </p>
            </div>

            <div className="flex justify-center items-baseline gap-4 text-3xl font-extralight text-neutral-600 tabular-nums">
              <span className="text-neutral-400">{String(timeLeft.hours ?? 0).padStart(2, '0')}</span>:
              <span className="text-neutral-400">{String(timeLeft.minutes ?? 0).padStart(2, '0')}</span>:
              <span className="text-white">{String(timeLeft.seconds ?? 0).padStart(2, '0')}</span>
              <span className="text-sm ml-1 opacity-20 font-mono">.{String(timeLeft.milli ?? 0).padStart(2, '0')}</span>
            </div>
          </div>
        )}

        {activeTab === 'legacy' && (
          <div className="w-full max-w-sm space-y-6 animate-in slide-in-from-bottom-6 duration-700">
            <div className="text-center space-y-2 mb-8">
              <h3 className="text-white text-sm font-bold tracking-widest uppercase">Digital Legacy</h3>
              <p className="text-[10px] text-neutral-600">あなたが去った後の意思を繋ぐ</p>
            </div>
            <div className="bg-neutral-900/30 border border-neutral-800 p-8 rounded-[2rem] flex items-center justify-between group transition-all hover:border-neutral-700">
              <div className="flex items-center gap-5">
                <Mail className="text-neutral-600 group-hover:text-white transition-colors" size={24} />
                <div>
                  <p className="text-white text-xs font-bold uppercase tracking-widest">Last Letter</p>
                  <p className="text-[9px] text-neutral-600 mt-1">死後に開封されるデジタル遺言</p>
                </div>
              </div>
              {!setup.isPremium && <Lock size={16} className="text-neutral-800" />}
            </div>
            {!setup.isPremium && (
              <div className="text-center pt-8">
                <button onClick={() => setShowPaywall(true)} className="text-[10px] text-white font-bold tracking-[0.3em] uppercase border-b border-white/20 pb-1 hover:border-white transition-all">
                  プレミアム機能をアンロック
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'insight' && (
          <div className="w-full max-w-sm space-y-6 animate-in slide-in-from-bottom-6 duration-700">
            <div className="bg-neutral-900/40 p-10 rounded-[2.5rem] border border-neutral-800 space-y-8 relative overflow-hidden">
              <div className="flex items-center gap-3 relative z-10">
                <TrendingUp size={20} className="text-emerald-500" />
                <span className="text-xs text-white font-bold tracking-widest uppercase">Optimization</span>
              </div>
              <div className="space-y-4 relative z-10">
                <p className="text-xs text-neutral-400 leading-relaxed">
                  現在の生活習慣データに基づき、あなたの期待寿命はさらに <span className="text-emerald-400 font-bold">+2.4年</span> 延長可能です。
                </p>
                {!setup.isPremium ? (
                  <div className="pt-4 border-t border-neutral-800/50">
                    <p className="text-[9px] text-neutral-600 uppercase tracking-widest leading-loose">
                      AIによる詳細な健康分析と<br />寿命シミュレーションをアンロック。
                    </p>
                  </div>
                ) : (
                  <div className="pt-4 border-t border-emerald-900/20">
                    <p className="text-[10px] text-emerald-500/80 italic">
                      ※Apple Healthとの同期が完了しています。
                    </p>
                  </div>
                )}
              </div>
              {!setup.isPremium && <Lock className="absolute bottom-6 right-8 text-neutral-800" size={60} />}
            </div>
          </div>
        )}
      </main>

      {/* Paywall Modal */}
      {showPaywall && (
        <div className="fixed inset-0 bg-black/98 z-50 flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in duration-500">
          <div className="max-w-sm w-full bg-neutral-900 border border-neutral-800 p-10 rounded-[3.5rem] space-y-10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5"><Award size={140} /></div>
            <div className="text-center space-y-4 relative z-10">
              <Award className="w-12 h-12 text-white mx-auto mb-2" />
              <h3 className="text-2xl text-white font-bold tracking-tight">PREMIUM ACCESS</h3>
              <p className="text-neutral-500 text-[10px] uppercase tracking-[0.3em] leading-relaxed">
                時間を「見る」ツールから<br />人生を「投資する」システムへ
              </p>
            </div>

            <div className="space-y-5 pt-6 border-t border-neutral-800 relative z-10">
              <div className="flex gap-4 items-center">
                <Mail size={16} className="text-neutral-500" />
                <p className="text-[10px] text-neutral-300 uppercase tracking-widest">Digital Last Letter</p>
              </div>
              <div className="flex gap-4 items-center">
                <TrendingUp size={16} className="text-neutral-500" />
                <p className="text-[10px] text-neutral-300 uppercase tracking-widest">AI Health Insight</p>
              </div>
              <div className="flex gap-4 items-center">
                <ShieldCheck size={16} className="text-neutral-500" />
                <p className="text-[10px] text-neutral-300 uppercase tracking-widest">Secure Cloud Sync</p>
              </div>
            </div>

            <div className="space-y-4 pt-8 relative z-10">
              <button
                onClick={handlePurchase}
                disabled={isProcessing}
                className="w-full py-5 bg-white text-black text-[11px] font-bold uppercase tracking-[0.4em] rounded-2xl hover:bg-neutral-200 active:scale-95 transition-all flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
              >
                {isProcessing ? 'Connecting...' : <><CreditCard size={14} /> ¥1,200 / Year</>}
              </button>
              <button onClick={() => setShowPaywall(false)} className="w-full py-2 text-neutral-600 text-[10px] uppercase tracking-widest font-bold hover:text-neutral-400">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Life Progress (Bottom) */}
      <div className="fixed bottom-0 left-0 w-full h-[1px] bg-neutral-900 z-50">
        <div
          className="h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)] transition-all duration-1000 ease-linear"
          style={{ width: `${timeLeft.percent}%` }}
        />
      </div>

      <footer className="p-12 text-center opacity-30 hover:opacity-100 transition-opacity">
        <p className="text-[8px] tracking-[0.5em] uppercase text-neutral-600">
          Memento Mori &copy; Final Edition v2.1.0
        </p>
      </footer>
    </div>
  );
};

export default App;
