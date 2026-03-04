import React, { useState, useEffect, useCallback } from 'react';
import { Settings2, Mail, Lock, Award, TrendingUp, ShieldCheck, CheckCircle2, CreditCard, ChevronRight } from 'lucide-react';
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
          // Very subtle pulse modifier (mostly handled by CSS backdrops now)
          setPulse(1 + (Math.sin(Date.now() / 1000) * 0.02));
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
      <div className="min-h-screen bg-[#030303] flex items-center justify-center p-6 relative overflow-hidden selection:bg-white selection:text-black">
        {/* Ambient background blur */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white rounded-full blur-[120px] mix-blend-screen opacity-[0.03] animate-breathe pointer-events-none" />

        <div className="max-w-md w-full z-10 space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="text-center space-y-6">
            <h1 className="text-4xl md:text-5xl font-serif text-white tracking-[0.3em] font-light">MEMENTO MORI</h1>
            <p className="text-neutral-500 text-[9px] tracking-[0.5em] uppercase font-medium">Time is the only asset</p>
          </div>

          <form onSubmit={handleInitialize} className="space-y-10 glass-panel p-10 md:p-12 rounded-[2rem] relative">
            <div className="absolute inset-0 border border-white/5 rounded-[2rem] pointer-events-none" />
            <div className="space-y-8">
              <div className="group relative">
                <label className="block text-[8px] uppercase tracking-[0.3em] text-neutral-500 mb-2 transition-colors group-focus-within:text-white">Date of Birth</label>
                <input
                  type="date"
                  required
                  className="w-full bg-transparent border-b border-neutral-800 pb-3 text-2xl font-light text-white outline-none focus:border-white transition-all [color-scheme:dark]"
                  value={setup.birthDate}
                  onChange={e => setSetup({ ...setup, birthDate: e.target.value })}
                />
              </div>
              <div className="group relative">
                <label className="block text-[8px] uppercase tracking-[0.3em] text-neutral-500 mb-2 transition-colors group-focus-within:text-white">Expectancy Age</label>
                <input
                  type="number"
                  className="w-full bg-transparent border-b border-neutral-800 pb-3 text-2xl font-light text-white outline-none focus:border-white transition-all"
                  value={setup.expectancy}
                  onChange={e => setSetup({ ...setup, expectancy: e.target.value })}
                />
              </div>
            </div>
            <button className="w-full py-5 bg-white text-black text-[10px] font-bold uppercase tracking-[0.4em] rounded-2xl flex items-center justify-center gap-3 hover:bg-neutral-200 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]">
              Launch Engine <ChevronRight size={14} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Safety guard for rendering
  if (!timeLeft) return null;

  return (
    <div className="min-h-screen bg-[#030303] text-neutral-400 font-sans flex flex-col relative overflow-hidden selection:bg-white selection:text-black">

      {/* Ambient Radial Pulse */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none mix-blend-screen opacity-50 z-0">
        <div
          className="w-[120vw] h-[120vw] md:w-[70vw] md:h-[70vw] rounded-full border border-white/10 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_0%,transparent_60%)] transition-transform duration-75 ease-out"
          style={{ transform: `scale(${pulse})` }}
        />
      </div>

      {/* Persistent Header */}
      <header className="p-6 md:p-8 flex justify-between items-center relative z-40">
        <div className="flex items-center gap-4 glass-panel px-5 py-2.5 rounded-full">
          <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.9)]" />
          <span className="text-[9px] font-semibold tracking-[0.35em] text-neutral-200 uppercase">Life Pulse</span>
        </div>

        <div className="flex items-center gap-4">
          {!setup.isPremium ? (
            <button
              onClick={() => setShowPaywall(true)}
              className="group flex items-center gap-2 px-5 py-2.5 bg-neutral-900 border border-neutral-800 rounded-full text-[9px] font-semibold tracking-widest text-white hover:border-[#e5a93d]/50 hover:bg-[#e5a93d]/5 transition-all"
            >
              <Award size={14} className="text-[#e5a93d] group-hover:drop-shadow-[0_0_8px_rgba(229,169,61,0.5)] transition-all" />
              <span className="mt-[1px]">UPGRADE</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 px-5 py-2.5 bg-[#e5a93d]/5 border border-[#e5a93d]/30 rounded-full text-[9px] font-semibold tracking-widest text-[#e5a93d]">
              <CheckCircle2 size={14} /> PREMIUM
            </div>
          )}
          <button
            onClick={() => setIsLive(false)}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-neutral-900 hover:text-white hover:border-neutral-700 transition-all bg-neutral-950/50"
          >
            <Settings2 size={16} />
          </button>
        </div>
      </header>

      {/* View Selector */}
      <nav className="flex justify-center gap-8 md:gap-16 mt-4 mb-8 md:mb-12 text-[9px] font-semibold tracking-[0.4em] uppercase relative z-30">
        {['timer', 'legacy', 'insight'].map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`transition-all pb-3 relative ${activeTab === t ? 'text-white' : 'text-neutral-600 hover:text-neutral-400'}`}
          >
            {t}
            {activeTab === t && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[1px] bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
            )}
          </button>
        ))}
      </nav>

      {/* Main Experience Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-20">

        {activeTab === 'timer' && (
          <div className="text-center space-y-16 md:space-y-24 animate-in fade-in zoom-in-95 duration-1000">
            <div onClick={() => setViewMode(v => v === 'days' ? 'percentage' : 'days')} className="cursor-pointer group select-none">
              <div className="text-7xl md:text-[11rem] font-mono font-extralight text-white tabular-nums tracking-tighter leading-none glowing-text opacity-90 transition-opacity hover:opacity-100">
                {viewMode === 'days' ? (timeLeft.days?.toLocaleString() ?? '---') : (timeLeft.percent?.toFixed(6) + '%')}
              </div>
              <p className="text-[10px] tracking-[0.6em] mt-10 md:mt-14 text-neutral-600 uppercase group-hover:text-white transition-colors duration-500 group-hover:shadow-[0_0_15px_rgba(255,255,255,0.3)] inline-block pb-1">
                {viewMode === 'days' ? 'Days to Dust' : 'Burned Life Progress'}
              </p>
            </div>

            <div className="flex justify-center items-end gap-3 md:gap-4 text-3xl md:text-5xl font-mono font-light text-neutral-600 tabular-nums">
              <span className="text-neutral-500">{String(timeLeft.hours ?? 0).padStart(2, '0')}</span><span className="text-neutral-800 text-xl md:text-2xl pb-[2px] md:pb-1">:</span>
              <span className="text-neutral-400">{String(timeLeft.minutes ?? 0).padStart(2, '0')}</span><span className="text-neutral-800 text-xl md:text-2xl pb-[2px] md:pb-1">:</span>
              <span className="text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">{String(timeLeft.seconds ?? 0).padStart(2, '0')}</span>
              <span className="text-xs md:text-sm ml-2 text-neutral-700 font-mono">.{String(timeLeft.milli ?? 0).padStart(2, '0')}</span>
            </div>
          </div>
        )}

        {activeTab === 'legacy' && (
          <div className="w-full max-w-md space-y-8 animate-in slide-in-from-bottom-8 duration-700">
            <div className="text-center space-y-3 mb-10">
              <h3 className="text-white text-sm font-semibold tracking-widest uppercase">Digital Legacy</h3>
              <p className="text-[10px] tracking-widest text-neutral-500">あなたが去った後の意思を繋ぐ</p>
            </div>

            <div className="glass-panel p-8 md:p-10 rounded-[2rem] flex items-center justify-between group transition-all hover:border-white/20 hover:shadow-[0_8px_40px_rgba(255,255,255,0.05)] cursor-pointer">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/5 group-hover:bg-white/10 transition-colors">
                  <Mail className="text-neutral-400 group-hover:text-white transition-colors" size={20} />
                </div>
                <div>
                  <p className="text-white text-[11px] font-bold uppercase tracking-widest">Last Letter</p>
                  <p className="text-[10px] text-neutral-500 mt-2 tracking-wide font-light">死後に開封されるデジタル遺言</p>
                </div>
              </div>
              {!setup.isPremium && <Lock size={16} className="text-neutral-700" />}
            </div>

            {!setup.isPremium && (
              <div className="text-center pt-8">
                <button onClick={() => setShowPaywall(true)} className="text-[9px] text-[#e5a93d] font-semibold tracking-[0.4em] uppercase border-b border-[#e5a93d]/30 pb-1 hover:border-[#e5a93d] transition-all">
                  プレミアム機能をアンロック
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'insight' && (
          <div className="w-full max-w-md space-y-6 animate-in slide-in-from-bottom-8 duration-700">
            <div className="glass-panel p-10 md:p-12 rounded-[2.5rem] space-y-8 relative overflow-hidden group">
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#e5a93d]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

              <div className="flex items-center gap-4 relative z-10">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <TrendingUp size={18} className="text-emerald-400" />
                </div>
                <span className="text-[11px] text-white font-bold tracking-[0.3em] uppercase">Optimization</span>
              </div>

              <div className="space-y-6 relative z-10 pt-2">
                <p className="text-sm text-neutral-300 leading-loose font-light">
                  現在の生活習慣データに基づき、あなたの期待寿命はさらに <span className="text-emerald-400 font-semibold drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">+2.4年</span> 延長可能です。
                </p>

                {!setup.isPremium ? (
                  <div className="pt-6 border-t border-white/5 relative">
                    <div className="absolute top-0 left-0 w-12 h-[1px] bg-neutral-800" />
                    <p className="text-[10px] text-neutral-500 uppercase tracking-widest leading-loose">
                      AIによる詳細な健康分析と<br />寿命シミュレーションをアンロック。
                    </p>
                  </div>
                ) : (
                  <div className="pt-6 border-t border-emerald-900/40 relative">
                    <div className="absolute top-0 left-0 w-12 h-[1px] bg-emerald-500/50" />
                    <p className="text-[10px] text-emerald-500/80 tracking-wide">
                      ※Apple Healthとの同期が完了しています。
                    </p>
                  </div>
                )}
              </div>
              {!setup.isPremium && <Lock className="absolute -bottom-6 -right-6 text-neutral-900/50" size={120} strokeWidth={1} />}
            </div>
          </div>
        )}
      </main>

      {/* Premium Paywall Modal */}
      {/* Premium Paywall Modal / Dead Man's Switch LP */}
      {showPaywall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-500 overflow-y-auto">
          <div className="fixed inset-0 bg-black/90 backdrop-blur-2xl" onClick={() => setShowPaywall(false)} />

          <div className="max-w-2xl w-full bg-[#050505] border border-red-900/30 p-8 md:p-14 rounded-3xl space-y-12 relative my-auto shadow-[0_0_80px_rgba(220,38,38,0.05)] mt-12 mb-12">
            <button onClick={() => setShowPaywall(false)} className="absolute top-6 right-6 text-neutral-600 hover:text-white transition-colors z-20 p-2 text-xl font-light">
              ✕
            </button>

            {/* Section 1: Hero */}
            <div className="text-center space-y-6 relative z-10 pb-8 border-b border-neutral-900">
              <ShieldCheck className="w-12 h-12 text-red-700/80 mx-auto mb-4" strokeWidth={1} />
              <h2 className="text-lg md:text-2xl text-white font-serif tracking-widest leading-relaxed">
                明日あなたが死んでも、世界は変わらない。<br />
                だが、あなたの「資産」と「尊厳」は確実に消失する。
              </h2>
              <p className="text-red-500 text-[10px] md:text-[11px] tracking-[0.3em] font-semibold uppercase mt-4">
                完全自動・死後発動型データ引継ぎシステム <br className="md:hidden" />「Dead Man's Switch」
              </p>
            </div>

            {/* Section 2: Agitation */}
            <div className="space-y-6 text-neutral-400 text-xs md:text-sm font-light leading-loose relative z-10">
              <p>
                目を背けるな。客観的な事実だけを述べる。<br />
                20代〜40代が「明日、突然死ぬ確率」はゼロではない。交通事故、脳血管疾患、急性心不全。これらは準備運動なしでやってくる。もし今、あなたの心臓が止まったらどうなるか。
              </p>
              <ul className="space-y-4 bg-red-950/10 border border-red-900/20 p-6 md:p-8 rounded-xl text-neutral-300">
                <li className="flex gap-4"><span className="text-red-500 mt-1">■</span> <span><strong className="text-white block mb-1 tracking-widest">資産の凍結：</strong>家族はパスワードを知らない。暗号資産やネット証券は永遠に引き出されず金融機関の利益になる。</span></li>
                <li className="flex gap-4"><span className="text-red-500 mt-1">■</span> <span><strong className="text-white block mb-1 tracking-widest">尊厳の崩壊：</strong>無防備な端末解析により、スマホ内の「見られたくないデータ」が白日の下に晒される。</span></li>
                <li className="flex gap-4"><span className="text-red-500 mt-1">■</span> <span><strong className="text-white block mb-1 tracking-widest">意思の消滅：</strong>「本当に伝えたかった言葉」は脳の機能停止と共に消え、誰にも引き継がれない。</span></li>
              </ul>
            </div>

            {/* Section 3: Solution */}
            <div className="space-y-6 text-neutral-400 text-xs md:text-sm font-light leading-loose relative z-10">
              <h3 className="text-white font-medium tracking-widest border-l-2 border-red-600 pl-4 mb-6">祈りや精神論でリスクは回避できない。<br />必要なのは「システム」だ。</h3>
              <p>
                あなたが本アプリを「30日間」一度も開かなかった場合、システムはあなたを「死亡状態」と合理的に判定し、暗号化された以下のデータを指定のキーパーソンへ自動送信する。
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                {[
                  "見られたくないデータの死後消去手順",
                  "分散したデジタル資産へのアクセス情報",
                  "法的遺言書の物理的な保管場所",
                  "特定の人物だけに見せたいメッセージ"
                ].map((item, i) => (
                  <div key={i} className="bg-neutral-900/50 border border-neutral-800 p-4 rounded-lg flex items-center gap-3">
                    <CheckCircle2 size={16} className="text-[#e5a93d]/50 flex-shrink-0" />
                    <span className="text-[10px] md:text-[11px] font-medium tracking-wider text-neutral-300">{item}</span>
                  </div>
                ))}
              </div>
              <p>
                月額980円。1日あたり約32円。これを「高い」と感じるなら、あなたの資産と尊厳はその程度の価値しかないということだ。
              </p>
            </div>

            {/* Section 4: CTA */}
            <div className="pt-8 space-y-4 relative z-10 text-center">
              <button
                onClick={handlePurchase}
                disabled={isProcessing}
                className="w-full py-5 md:py-6 bg-red-700 hover:bg-red-600 text-white text-[11px] md:text-[13px] font-bold uppercase tracking-[0.2em] rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(220,38,38,0.2)]"
              >
                {isProcessing ? 'Connecting...' : <><Lock size={18} /> Dead Man's Switch を有効化する (月額¥980)</>}
              </button>
              <p className="text-[9px] md:text-[10px] text-neutral-500 tracking-widest mt-6">
                ※リスクを認識しながら対策を講じないのは、怠慢ではなく「愚行」だ。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Life Progress Line (Bottom) */}
      <div className="absolute bottom-0 left-0 w-full h-[2px] bg-neutral-900 z-50 overflow-hidden">
        <div
          className="h-full bg-white relative transition-all duration-1000 ease-linear"
          style={{ width: `${timeLeft.percent}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-[20px] bg-white blur-md opacity-50" />
        </div>
      </div>

      <footer className="p-10 text-center relative z-20 pointer-events-none">
        <p className="text-[8px] tracking-[0.5em] uppercase text-neutral-700 font-medium">
          Memento Mori &copy; Final Edition v3.0 // Precision
        </p>
      </footer>
    </div>
  );
};

export default App;
