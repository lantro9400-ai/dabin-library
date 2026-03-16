import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  BookOpen, Search, Plus, Award, Moon, Sun,
  X, Timer, Pause, CheckCircle2,
  Library, Flame, History, BookMarked, Headphones, Volume2, VolumeX
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────
// ASMR 사운드 엔진
// src 있으면 MP3 파일 사용, 없으면 Web Audio API 프로시저럴 생성
// ─────────────────────────────────────────────────────────────────
const ASMR_SOUNDS = [
  { id: 'rain',    label: '빗소리',   emoji: '🌧️', src: '/rain.mp3' },
  { id: 'fire',    label: '장작불',   emoji: '🔥', src: '/fire.mp3' },
  { id: 'ocean',   label: '파도소리', emoji: '🌊' },
  { id: 'forest',  label: '숲속',     emoji: '🌿' },
  { id: 'wind',    label: '산바람',   emoji: '🏔️' },
];

// 노이즈 버퍼 생성기
function makeNoiseBuffer(ctx, type = 'pink', seconds = 4) {
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  if (type === 'white') {
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } else if (type === 'pink') {
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
      b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
      b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
      d[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11; b6=w*0.115926;
    }
  } else if (type === 'brown') {
    let last=0;
    for (let i = 0; i < len; i++) {
      const w = Math.random()*2-1;
      d[i]=(last+(0.02*w))/1.02; last=d[i]; d[i]*=3.5;
    }
  }
  return buf;
}

function buildSound(ctx, master, soundId) {
  const nodes = [];
  const cleanup = () => nodes.forEach(n => { try { n.stop?.(); n.disconnect?.(); } catch{} });

  const src = ctx.createBufferSource();
  src.loop = true;
  nodes.push(src);

  const gainNode = ctx.createGain();
  gainNode.gain.value = 1;
  nodes.push(gainNode);

  if (soundId === 'rain') {
    src.buffer = makeNoiseBuffer(ctx, 'pink', 5);
    const f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=1400; f.Q.value=0.5;
    src.connect(f); f.connect(gainNode); gainNode.connect(master);
    nodes.push(f);

  } else if (soundId === 'ocean') {
    src.buffer = makeNoiseBuffer(ctx, 'brown', 5);
    const f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=500; f.Q.value=0.8;
    // LFO for wave rhythm
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.35;
    gainNode.gain.value = 0.65;
    lfo.connect(lfoGain); lfoGain.connect(gainNode.gain);
    lfo.start();
    src.connect(f); f.connect(gainNode); gainNode.connect(master);
    nodes.push(f, lfo, lfoGain);

  } else if (soundId === 'forest') {
    // 바람 + 살랑이는 나뭇잎
    src.buffer = makeNoiseBuffer(ctx, 'pink', 5);
    const f1 = ctx.createBiquadFilter(); f1.type='bandpass'; f1.frequency.value=600; f1.Q.value=0.3;
    const f2 = ctx.createBiquadFilter(); f2.type='lowpass'; f2.frequency.value=1800;
    // 느린 LFO로 바람 세기 변화
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.2;
    gainNode.gain.value = 0.7;
    lfo.connect(lfoGain); lfoGain.connect(gainNode.gain);
    lfo.start();
    src.connect(f1); f1.connect(f2); f2.connect(gainNode); gainNode.connect(master);
    nodes.push(f1, f2, lfo, lfoGain);

  } else if (soundId === 'fire') {
    // 베이스 불꽃 소리
    src.buffer = makeNoiseBuffer(ctx, 'brown', 5);
    const f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=900; f.Q.value=1.2;
    gainNode.gain.value = 0.75;
    src.connect(f); f.connect(gainNode); gainNode.connect(master);
    nodes.push(f);

    // 장작 튀기는 소리 (랜덤 크래클)
    const crackGain = ctx.createGain(); crackGain.gain.value = 0; crackGain.connect(master);
    const crackSrc = ctx.createBufferSource();
    crackSrc.buffer = makeNoiseBuffer(ctx, 'white', 2);
    crackSrc.loop = true;
    const crackFilter = ctx.createBiquadFilter(); crackFilter.type='highpass'; crackFilter.frequency.value=2000;
    crackSrc.connect(crackFilter); crackFilter.connect(crackGain); crackSrc.start();
    nodes.push(crackSrc, crackGain, crackFilter);

    const scheduleCrackle = () => {
      if (!crackGain.context || crackGain.context.state === 'closed') return;
      const now = ctx.currentTime;
      const numPops = Math.floor(Math.random() * 4) + 1;
      for (let i = 0; i < numPops; i++) {
        const t = now + Math.random() * 1.5;
        crackGain.gain.setValueAtTime(0.0, t);
        crackGain.gain.linearRampToValueAtTime(0.6 + Math.random()*0.4, t + 0.005);
        crackGain.gain.linearRampToValueAtTime(0.0, t + 0.02 + Math.random()*0.03);
      }
      const nextIn = 400 + Math.random() * 1200;
      return setTimeout(scheduleCrackle, nextIn);
    };
    const crackTimer = scheduleCrackle();
    const origCleanup = cleanup;
    nodes.push({ disconnect: () => clearTimeout(crackTimer), stop: () => {} });

  } else if (soundId === 'wind') {
    src.buffer = makeNoiseBuffer(ctx, 'white', 5);
    const f1 = ctx.createBiquadFilter(); f1.type='bandpass'; f1.frequency.value=400; f1.Q.value=0.1;
    const f2 = ctx.createBiquadFilter(); f2.type='peaking'; f2.frequency.value=200; f2.gain.value=8;
    // 강한 LFO로 바람 휘몰아치는 느낌
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.12; lfo.type='sine';
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.5;
    gainNode.gain.value = 0.5;
    lfo.connect(lfoGain); lfoGain.connect(gainNode.gain);
    lfo.start();
    src.connect(f1); f1.connect(f2); f2.connect(gainNode); gainNode.connect(master);
    nodes.push(f1, f2, lfo, lfoGain);
  }

  src.start();
  return cleanup;
}

function useAsmr() {
  const ctxRef = useRef(null);
  const masterGainRef = useRef(null);
  const cleanupRef = useRef(null);   // Web Audio API 정리 함수
  const audioElRef = useRef(null);   // HTML5 Audio 엘리먼트 (MP3용)
  const [activeSound, setActiveSound] = useState(null);
  const [volume, setVolume] = useState(0.6);

  const stopAll = () => {
    // Web Audio API 정리
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
    // HTML5 Audio 정리
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = '';
      audioElRef.current = null;
    }
  };

  const getCtx = () => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      masterGainRef.current = ctxRef.current.createGain();
      masterGainRef.current.gain.value = volume;
      masterGainRef.current.connect(ctxRef.current.destination);
    }
    return ctxRef.current;
  };

  const play = useCallback((soundId) => {
    stopAll();
    if (activeSound === soundId) { setActiveSound(null); return; }

    const sound = ASMR_SOUNDS.find(s => s.id === soundId);

    if (sound?.src) {
      // MP3 파일 재생 (HTML5 Audio)
      const audio = new Audio(sound.src);
      audio.loop = true;
      audio.volume = volume;
      audio.play().catch(console.error);
      audioElRef.current = audio;
    } else {
      // Web Audio API 프로시저럴 사운드
      const ctx = getCtx();
      if (ctx.state === 'suspended') ctx.resume();
      cleanupRef.current = buildSound(ctx, masterGainRef.current, soundId);
    }

    setActiveSound(soundId);
  }, [activeSound, volume]);

  const changeVolume = useCallback((v) => {
    setVolume(v);
    // HTML5 Audio 볼륨
    if (audioElRef.current) audioElRef.current.volume = v;
    // Web Audio API 볼륨
    if (masterGainRef.current) {
      masterGainRef.current.gain.setTargetAtTime(v, masterGainRef.current.context.currentTime, 0.05);
    }
  }, []);

  useEffect(() => () => { stopAll(); ctxRef.current?.close(); }, []);

  return { activeSound, volume, play, changeVolume };
}

// ─────────────────────────────────────────────────────────────────
// 다람쥐 캐릭터
// ─────────────────────────────────────────────────────────────────
const CuteSquirrel = ({ mood = 'happy', className = 'w-10 h-10' }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M 30 80 C 10 80, 5 40, 20 30 C 35 20, 50 40, 40 60" fill="#B45309" />
    <path d="M 35 75 C 15 75, 10 45, 25 35 C 35 25, 45 45, 35 55" fill="#D97706" />
    <ellipse cx="60" cy="70" rx="25" ry="20" fill="#D97706" />
    <ellipse cx="55" cy="75" rx="15" ry="10" fill="#FDE68A" />
    <path d="M 45 40 L 50 25 L 60 35 Z" fill="#B45309" />
    <path d="M 75 40 L 70 25 L 60 35 Z" fill="#B45309" />
    <ellipse cx="60" cy="50" rx="22" ry="18" fill="#D97706" />
    <circle cx="50" cy="48" r="8" fill="none" stroke="#451A03" strokeWidth="2" />
    <circle cx="70" cy="48" r="8" fill="none" stroke="#451A03" strokeWidth="2" />
    <path d="M 58 48 L 62 48" stroke="#451A03" strokeWidth="2" />
    {mood === 'sleeping' ? (
      <>
        <path d="M 46 48 Q 50 45 54 48" stroke="#451A03" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M 66 48 Q 70 45 74 48" stroke="#451A03" strokeWidth="2" fill="none" strokeLinecap="round" />
        <text x="80" y="30" fontSize="14" fill="#78350F" fontWeight="bold">Z</text>
        <text x="92" y="20" fontSize="10" fill="#78350F" fontWeight="bold">z</text>
      </>
    ) : (
      <>
        <circle cx="50" cy="48" r="2.5" fill="#451A03" />
        <circle cx="70" cy="48" r="2.5" fill="#451A03" />
      </>
    )}
    <circle cx="60" cy="55" r="2" fill="#78350F" />
    {(mood === 'happy' || mood === 'bolppang') && (
      <path d="M 55 58 Q 60 62 65 58" stroke="#451A03" strokeWidth="2" fill="none" strokeLinecap="round" />
    )}
    {mood === 'bolppang' && (
      <>
        <circle cx="38" cy="58" r="12" fill="#FDE68A" />
        <circle cx="82" cy="58" r="12" fill="#FDE68A" />
        <circle cx="38" cy="58" r="5" fill="#FCA5A5" opacity="0.8" />
        <circle cx="82" cy="58" r="5" fill="#FCA5A5" opacity="0.8" />
        <path d="M 10 30 L 15 35 L 10 40 Z" fill="#FCD34D" />
        <path d="M 90 20 L 95 25 L 90 30 Z" fill="#FCD34D" />
      </>
    )}
    {mood === 'happy' && (
      <>
        <ellipse cx="45" cy="55" rx="4" ry="2" fill="#FCA5A5" opacity="0.5"/>
        <ellipse cx="75" cy="55" rx="4" ry="2" fill="#FCA5A5" opacity="0.5"/>
      </>
    )}
    <path d="M 45 70 L 55 75 L 55 85 L 45 80 Z" fill="#3B82F6" />
    <path d="M 55 75 L 65 70 L 65 80 L 55 85 Z" fill="#60A5FA" />
    <path d="M 55 75 L 55 85" stroke="#1E3A8A" strokeWidth="1" />
  </svg>
);

// 책 표지 컴포넌트 (이미지 오류 시 fallback)
const BookCover = ({ thumbnail, className = "w-full h-full" }) => {
  const [err, setErr] = useState(false);
  if (thumbnail && !err) {
    return <img src={thumbnail} alt="cover" className={`${className} object-cover`} onError={() => setErr(true)} />;
  }
  return (
    <div className={`${className} bg-amber-100 flex items-center justify-center`}>
      <BookOpen className="w-8 h-8 text-amber-300" />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// 메인 앱
// ─────────────────────────────────────────────────────────────────
export default function App() {
  const [books, setBooks] = useState([]);
  const [records, setRecords] = useState({});
  const [viewMode, setViewMode] = useState('library');
  const [toast, setToast] = useState('');
  const [isDark, setIsDark] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isAsmrOpen, setIsAsmrOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [selectedBook, setSelectedBook] = useState(null);
  const [readPagesInput, setReadPagesInput] = useState(0);

  const [timerTime, setTimerTime] = useState(30 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef(null);

  const asmr = useAsmr();

  useEffect(() => {
    const b = localStorage.getItem('acornBooks');
    if (b) setBooks(JSON.parse(b));
    const r = localStorage.getItem('acornRecords');
    if (r) setRecords(JSON.parse(r));
    const s = localStorage.getItem('acornSettings');
    if (s) setIsDark(JSON.parse(s).isDark);
  }, []);

  useEffect(() => localStorage.setItem('acornBooks', JSON.stringify(books)), [books]);
  useEffect(() => localStorage.setItem('acornRecords', JSON.stringify(records)), [records]);
  useEffect(() => {
    localStorage.setItem('acornSettings', JSON.stringify({ isDark }));
    document.body.style.backgroundColor = isDark ? '#111827' : '#FFFBEB';
  }, [isDark]);

  useEffect(() => {
    if (isTimerRunning && timerTime > 0) {
      timerRef.current = setInterval(() => setTimerTime(p => p - 1), 1000);
    } else if (timerTime === 0 && isTimerRunning) {
      clearInterval(timerRef.current);
      setIsTimerRunning(false);
      showToast('⏰ 집중 독서 완료! 다람쥐가 도토리를 물어왔어요 🌰');
      setTimerTime(30 * 60);
    }
    return () => clearInterval(timerRef.current);
  }, [isTimerRunning, timerTime]);

  const toggleTimer = () => setIsTimerRunning(p => !p);
  const fmt = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  // ── Tavily API 책 검색 ───────────────────────────────────────────
  // CORS 지원, 한국어/영어 모두 지원
  // 책 표지: Yes24 CDN 패턴, 교보 ISBN 패턴 순서로 시도
  const TAVILY_KEY = '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';

  const parseThumbnail = (url, content) => {
    // 1) Yes24 상품 URL → CDN 표지
    const yes24 = url.match(/yes24\.com\/Product\/Goods\/(\d+)/i);
    if (yes24) return `https://image.yes24.com/goods/${yes24[1]}/XL`;

    // 2) ISBN 추출 → 교보 CDN 표지
    const isbnMatch = content.match(/(?:ISBN|isbn)[^\d]*(\d{13})/) ||
                      content.match(/\b(978\d{10})\b/);
    if (isbnMatch) {
      const isbn = isbnMatch[1];
      return `https://contents.kyobobook.co.kr/sih/dimgfserver/cover/${isbn.slice(0, 3)}/${isbn}.png`;
    }

    return '';
  };

  const parseAuthorFromContent = (content) => {
    const patterns = [
      /저자?\s*[:\|]\s*([^|\n,·]{2,20})/,
      /글\s*[:\|]?\s*([^|\n,·]{2,15})/,
      /([^|\n,·]{2,15})\s+지음/,
      /([^|\n,·]{2,15})\s+저(?:\s|$)/,
      /by\s+([^|\n,·]{2,30})/i,
    ];
    for (const p of patterns) {
      const m = content.match(p);
      if (m) return m[1].replace(/[<>[\]()]/g, '').trim();
    }
    return '작자 미상';
  };

  const parsePageFromContent = (content) => {
    const patterns = [
      /쪽수[^\d]*(\d{2,4})\s*쪽/,
      /(\d{2,4})\s*페이지/,
      /(\d{2,4})\s*쪽/,
      /(\d{2,4})\s*p(?:ages?)?(?:\s|$)/i,
    ];
    for (const p of patterns) {
      const m = content.match(p);
      if (m) {
        const n = parseInt(m[1]);
        if (n >= 50 && n <= 5000) return n;
      }
    }
    return 300;
  };

  const cleanTitle = (raw) =>
    raw
      .replace(/\s*[-|–]\s*(YES24|알라딘|교보문고|리디|예스24|인터파크|영풍문고|네이버도서|도서).*$/i, '')
      .replace(/^(알라딘|교보문고|YES24|리디)\s*[:：]\s*/i, '')
      .replace(/\s*\|\s*교보문고$/, '')
      .trim();

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    setSearchResults([]);

    try {
      const isKorean = /[가-힣]/.test(searchQuery);

      const body = {
        api_key: TAVILY_KEY,
        query: isKorean
          ? `${searchQuery} 책 도서 정보`
          : `${searchQuery} book`,
        search_depth: 'basic',
        include_images: true,
        max_results: 10,
      };

      if (isKorean) {
        body.include_domains = ['yes24.com', 'aladin.co.kr', 'kyobobook.co.kr'];
      }

      // 15초 타임아웃
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);

      const res = await fetch('/api/tavily/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) throw new Error(`Tavily 오류 ${res.status}`);

      const data = await res.json();
      const results = data.results ?? [];
      const images = data.images ?? [];

      if (results.length === 0) {
        setSearchResults([]);
        return;
      }

      // 결과 파싱 — 동일 책의 중복 URL 제거
      const seen = new Set();
      const parsed = results
        .filter(r => {
          if (seen.has(r.url)) return false;
          seen.add(r.url);
          return true;
        })
        .map((r, idx) => {
          const thumbnail =
            parseThumbnail(r.url, r.content) ||
            // 교보 검색결과 페이지인 경우 images 풀에서 Yes24 커버 이미지 우선 선택
            images.find(img => /image\.yes24\.com\/goods\/\d+/.test(img)) ||
            images[idx] ||
            '';

          return {
            apiId: r.url,
            title: cleanTitle(r.title),
            author: parseAuthorFromContent(r.content),
            thumbnail,
            totalPage: parsePageFromContent(r.content),
            description: r.content.slice(0, 200),
          };
        })
        .filter(b => b.title.length > 0);

      setSearchResults(parsed);
    } catch (err) {
      console.error('Tavily Search Error:', err);
      showToast(`검색 오류: ${err.message}`);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const addBook = (bookData) => {
    if (books.find(b => b.apiId === bookData.apiId)) {
      showToast('이미 서재에 있는 책이에요!'); return;
    }
    setBooks([{ ...bookData, id: Date.now().toString(), readPages: 0, status: 'reading', startDate: fmtDate(new Date()), endDate: null, rating: 0 }, ...books]);
    setIsSearchOpen(false); setSearchQuery(''); setSearchResults([]);
    showToast(`📚 '${bookData.title}'을(를) 서재에 꽂았어요!`);
  };

  const updateProgress = (e) => {
    e.preventDefault();
    if (!selectedBook) return;
    let newPages = Math.max(0, Math.min(Number(readPagesInput), selectedBook.totalPage));
    const pagesReadToday = newPages - selectedBook.readPages;
    setBooks(books.map(b => {
      if (b.id !== selectedBook.id) return b;
      const done = newPages >= b.totalPage;
      return { ...b, readPages: newPages, status: done ? 'completed' : 'reading', endDate: done && !b.endDate ? fmtDate(new Date()) : b.endDate };
    }));
    if (pagesReadToday > 0) {
      const today = fmtDate(new Date());
      const cur = records[today] || { pages: 0, time: 0 };
      setRecords({ ...records, [today]: { ...cur, pages: cur.pages + pagesReadToday } });
      showToast(`🌰 도토리를 찾았어요! (+${pagesReadToday}p)`);
    }
    setIsBookModalOpen(false);
  };

  const deleteBook = (id) => {
    setBooks(books.filter(b => b.id !== id));
    setIsBookModalOpen(false);
    showToast('책을 서재에서 뺐어요.');
  };

  const calculateStreak = () => {
    let streak = 0;
    const today = new Date(); today.setHours(0,0,0,0);
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      if (records[fmtDate(d)]?.pages > 0) streak++;
      else { if (i === 0) continue; break; }
    }
    return streak;
  };

  const streak = calculateStreak();
  const isBolppang = streak >= 3;

  const tBg = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-amber-100';
  const tTextMain = isDark ? 'text-gray-100' : 'text-gray-800';
  const tTextSub = isDark ? 'text-gray-400' : 'text-amber-700/60';
  const tCard = isDark ? 'bg-gray-700 border-gray-600 hover:border-gray-500' : 'bg-orange-50/30 border-orange-100/50 hover:shadow-md hover:border-orange-200';
  const tInput = isDark ? 'bg-gray-700/50 border-gray-600/50 text-white' : 'bg-white border-amber-200 text-gray-800 focus:border-amber-400';

  // ── 내 서재 뷰 ────────────────────────────────────────────────────
  const renderLibrary = () => {
    const reading = books.filter(b => b.status === 'reading');
    const done = books.filter(b => b.status === 'completed');
    return (
      <div>
        <button
          onClick={() => { setIsSearchOpen(true); setHasSearched(false); setSearchResults([]); setSearchQuery(''); }}
          className={`w-full py-4 mb-6 rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 font-bold transition-all hover:scale-[1.02] active:scale-95 ${isDark ? 'border-gray-600 text-gray-400 hover:border-orange-400 hover:text-orange-400' : 'border-amber-300 text-amber-600 hover:border-orange-400 hover:text-orange-500 hover:bg-orange-50'}`}
        >
          <Plus className="w-5 h-5" /> 새로운 책 추가하기
        </button>

        <h3 className={`font-black text-lg mb-4 flex items-center gap-2 ${tTextMain}`}>
          <BookOpen className="w-5 h-5 text-orange-500" /> 읽고 있는 책 ({reading.length})
        </h3>
        <div className="space-y-4 mb-8">
          {reading.length === 0 ? (
            <div className="text-center py-10 opacity-70">
              <BookMarked className="w-12 h-12 mx-auto mb-3 text-amber-300" />
              <p className={tTextSub}>지금 읽고 있는 책이 없어요.<br/>새로운 책을 찾아볼까요?</p>
            </div>
          ) : reading.map(book => {
            const pct = Math.round((book.readPages / book.totalPage) * 100);
            return (
              <div key={book.id} onClick={() => { setSelectedBook(book); setReadPagesInput(book.readPages); setIsBookModalOpen(true); }} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${tCard} flex gap-4`}>
                <div className="w-16 h-24 rounded-lg shadow-sm overflow-hidden flex-shrink-0 border border-gray-100">
                  <BookCover thumbnail={book.thumbnail} />
                </div>
                <div className="flex-1 flex flex-col justify-center">
                  <h4 className={`font-bold text-base mb-1 ${tTextMain}`} style={{overflow:'hidden',display:'-webkit-box',WebkitBoxOrient:'vertical',WebkitLineClamp:1}}>{book.title}</h4>
                  <p className={`text-xs mb-3 ${tTextSub}`} style={{overflow:'hidden',display:'-webkit-box',WebkitBoxOrient:'vertical',WebkitLineClamp:1}}>{book.author}</p>
                  <div className="flex items-center gap-2">
                    <div className={`flex-1 h-2.5 rounded-full overflow-hidden ${isDark ? 'bg-gray-600' : 'bg-amber-100'}`}>
                      <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500" style={{width:`${pct}%`}} />
                    </div>
                    <span className={`text-[11px] font-black w-8 text-right ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>{pct}%</span>
                  </div>
                  <div className={`text-[10px] mt-1 text-right font-medium ${tTextSub}`}>{book.readPages}/{book.totalPage}p</div>
                </div>
              </div>
            );
          })}
        </div>

        {done.length > 0 && (
          <>
            <h3 className={`font-black text-lg mb-4 flex items-center gap-2 ${tTextMain}`}>
              <Award className="w-5 h-5 text-amber-500" /> 다 읽은 책 ({done.length})
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {done.map(book => (
                <div key={book.id} onClick={() => { setSelectedBook(book); setReadPagesInput(book.readPages); setIsBookModalOpen(true); }} className="cursor-pointer group">
                  <div className="aspect-[2/3] rounded-xl shadow-sm overflow-hidden border border-gray-200 mb-2 transition-transform group-hover:-translate-y-1 group-hover:shadow-md relative">
                    <BookCover thumbnail={book.thumbnail} />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <p className={`text-xs font-bold text-center ${tTextMain}`} style={{overflow:'hidden',display:'-webkit-box',WebkitBoxOrient:'vertical',WebkitLineClamp:1}}>{book.title}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  // ── 도토리 창고 뷰 ────────────────────────────────────────────────
  const renderAcorn = () => {
    const today = new Date(); today.setHours(0,0,0,0);
    const days = Array.from({length:35},(_,i)=>{
      const d = new Date(today); d.setDate(d.getDate()-(34-i));
      const dStr = fmtDate(d);
      const pages = records[dStr]?.pages || 0;
      let bg = isDark ? 'bg-gray-700' : 'bg-amber-100/50';
      if (pages>0&&pages<=10) bg='bg-amber-300';
      else if (pages>10&&pages<=30) bg='bg-orange-400';
      else if (pages>30) bg='bg-orange-600';
      return <div key={i} title={`${dStr}: ${pages}p 읽음`} className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg ${bg} hover:scale-125 transition-transform cursor-pointer flex items-center justify-center`}>{pages>0&&<span className="text-[10px]">🌰</span>}</div>;
    });
    return (
      <div>
        <div className={`mt-2 p-6 rounded-[2rem] border-2 ${tCard} flex flex-col items-center mb-6`}>
          <div className="flex items-center gap-2 mb-6 text-base font-extrabold w-full text-orange-600">
            <History className="w-5 h-5" /> 나의 도토리 창고 (최근 35일)
          </div>
          <div className="grid grid-cols-7 gap-2 sm:gap-3">{days}</div>
          <div className="w-full flex justify-end items-center gap-2 mt-4 text-[11px] font-bold text-gray-400">
            <span>조금</span>
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded bg-amber-300"/><div className="w-3 h-3 rounded bg-orange-400"/><div className="w-3 h-3 rounded bg-orange-600"/>
            </div>
            <span>많이</span>
          </div>
        </div>
        <div className="p-6 rounded-[2rem] bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 opacity-20"><CuteSquirrel mood="bolppang" className="w-32 h-32"/></div>
          <h3 className="text-xl font-black mb-6 relative z-10">다람쥐의 성적표 📜</h3>
          <div className="grid grid-cols-2 gap-4 relative z-10">
            <div className="bg-white/20 rounded-2xl p-4 border border-white/30">
              <p className="text-amber-100 text-xs font-bold mb-1">지금까지 모은 도토리</p>
              <p className="text-3xl font-black">{Object.values(records).reduce((s,r)=>s+r.pages,0)}<span className="text-sm text-amber-100 ml-1">개(p)</span></p>
            </div>
            <div className="bg-white/20 rounded-2xl p-4 border border-white/30">
              <p className="text-amber-100 text-xs font-bold mb-1">완독한 책</p>
              <p className="text-3xl font-black">{books.filter(b=>b.status==='completed').length}<span className="text-sm text-amber-100 ml-1">권</span></p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen font-sans flex justify-center py-6 px-3 sm:py-10 sm:px-4 transition-colors ${isDark ? 'bg-gray-900' : 'bg-[#FFFBEB]'}`}>

      {/* 토스트 */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900/90 text-white px-6 py-3.5 rounded-full shadow-2xl font-bold text-sm flex items-center gap-2 border-2 border-white/20 backdrop-blur-md">
          🌰 {toast}
        </div>
      )}

      {/* ── 메인 카드 ─────────────────────────────────────────────── */}
      <div className={`w-full max-w-[460px] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-[850px] max-h-[90vh] border-4 border-white/60 ${tBg}`}>

        <div className="p-6 pb-0">
          {/* 헤더 */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <CuteSquirrel mood={isBolppang ? 'bolppang' : (books.length === 0 ? 'sleeping' : 'happy')} className="w-12 h-12" />
              <div>
                <h1 className="text-[20px] font-black tracking-tight text-orange-600">다빈다람쥐의 도서관</h1>
                <div className="flex gap-1 mt-0.5">
                  {streak > 0 && <span className="text-[10px] font-extrabold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">🌰 {streak}일째 독서중!</span>}
                  {isBolppang && <span className="text-[10px] font-extrabold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full flex items-center gap-1"><Flame className="w-3 h-3 fill-current"/> 볼빵빵!</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {/* 타이머 */}
              <button onClick={toggleTimer} className={`flex items-center gap-1.5 p-2.5 rounded-2xl font-bold text-sm shadow-sm transition-all ${isTimerRunning ? 'bg-orange-500 text-white' : (isDark ? 'text-gray-400 bg-gray-700 hover:bg-gray-600' : 'text-orange-600 bg-orange-50 hover:bg-orange-100')}`}>
                {isTimerRunning ? <Pause className="w-5 h-5 fill-current"/> : <Timer className="w-5 h-5"/>}
                <span className="hidden sm:inline">{fmt(timerTime)}</span>
              </button>
              {/* ASMR 버튼 */}
              <button onClick={() => setIsAsmrOpen(p=>!p)} className={`p-2.5 rounded-2xl transition-all ${asmr.activeSound ? 'bg-emerald-500 text-white' : (isDark ? 'text-gray-400 bg-gray-700 hover:bg-gray-600' : 'text-gray-500 bg-gray-100 hover:bg-gray-200')}`} title="집중 사운드 ASMR">
                <Headphones className="w-5 h-5" />
              </button>
              {/* 다크모드 */}
              <button onClick={() => setIsDark(p=>!p)} className={`p-2.5 rounded-2xl transition-all ${isDark ? 'text-yellow-400 bg-gray-700' : 'text-gray-400 bg-gray-100 hover:bg-gray-200'}`}>
                {isDark ? <Moon className="w-5 h-5 fill-current"/> : <Sun className="w-5 h-5 fill-current"/>}
              </button>
            </div>
          </div>

          {/* ASMR 패널 (헤더 아래 슬라이드) */}
          {isAsmrOpen && (
            <div className={`mb-4 rounded-2xl border-2 p-4 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-emerald-50 border-emerald-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-sm font-black flex items-center gap-1.5 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  <Headphones className="w-4 h-4" /> 집중 사운드
                  {asmr.activeSound && <span className="text-[10px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full animate-pulse ml-1">재생중</span>}
                </span>
                {/* 볼륨 */}
                <div className="flex items-center gap-2">
                  {asmr.volume === 0 ? <VolumeX className="w-4 h-4 text-gray-400"/> : <Volume2 className="w-4 h-4 text-emerald-500"/>}
                  <input
                    type="range" min="0" max="1" step="0.05"
                    value={asmr.volume}
                    onChange={e => asmr.changeVolume(Number(e.target.value))}
                    className="w-20 h-1.5 accent-emerald-500 cursor-pointer"
                  />
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {ASMR_SOUNDS.map(s => (
                  <button
                    key={s.id}
                    onClick={() => asmr.play(s.id)}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-[11px] font-bold transition-all active:scale-95 ${asmr.activeSound === s.id ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' : (isDark ? 'bg-gray-600 text-gray-300 hover:bg-gray-500' : 'bg-white text-gray-600 hover:bg-emerald-100 border border-emerald-100')}`}
                  >
                    <span className="text-xl">{s.emoji}</span>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 탭 */}
          <div className={`flex rounded-2xl p-1.5 mb-6 shadow-inner ${isDark ? 'bg-gray-900 border border-gray-700' : 'bg-amber-100/50'}`}>
            {[['library','내 서재','Library'],['records','창고 기록','History']].map(([mode, label]) => (
              <button key={mode} onClick={() => setViewMode(mode)} className={`flex-1 py-2.5 text-sm font-extrabold rounded-xl transition-all duration-300 flex justify-center items-center gap-2 ${viewMode === mode ? (isDark ? 'bg-gray-700 text-white shadow-md' : 'bg-white text-orange-600 shadow-md') : (isDark ? 'text-gray-500' : 'text-amber-700/50')}`}>
                {mode === 'library' ? <><Library className="w-4 h-4"/> {label}</> : <><History className="w-4 h-4"/> {label}</>}
              </button>
            ))}
          </div>
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-0" style={{scrollbarWidth:'thin',scrollbarColor:isDark?'#4b5563 transparent':'#fcd34d transparent'}}>
          {viewMode === 'library' ? renderLibrary() : renderAcorn()}
        </div>
      </div>

      {/* ── 책 검색 모달 ─────────────────────────────────────────── */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsSearchOpen(false)}>
          <div className={`rounded-[2rem] shadow-2xl w-full max-w-md h-[80vh] flex flex-col overflow-hidden border-4 border-white/50 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
            <div className={`p-6 border-b flex justify-between items-center ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-orange-50 border-orange-100'}`}>
              <h3 className={`text-xl font-black flex items-center gap-2 ${tTextMain}`}><Search className="w-6 h-6 text-orange-500"/> 책 찾기</h3>
              <button onClick={() => setIsSearchOpen(false)} className={`p-2 rounded-full shadow-sm ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-white text-gray-400'} hover:text-rose-500`}><X className="w-5 h-5"/></button>
            </div>
            <div className={`p-4 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className={`flex-1 flex items-center px-4 py-3 rounded-2xl border-2 ${tInput}`}>
                  <Search className={`w-5 h-5 mr-2 flex-shrink-0 ${isDark ? 'text-gray-400' : 'text-amber-400'}`}/>
                  <input type="text" autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="책 제목이나 저자를 검색하세요" className="flex-1 outline-none bg-transparent text-sm font-medium"/>
                </div>
                <button type="submit" disabled={isSearching} className="bg-orange-500 text-white px-5 rounded-2xl font-bold hover:bg-orange-600 transition-colors disabled:opacity-50 whitespace-nowrap">
                  {isSearching ? '검색중...' : '검색'}
                </button>
              </form>
              <p className={`text-[11px] mt-2 ml-1 ${tTextSub}`}>Open Library 데이터베이스로 검색합니다 (한국어·영어 모두 지원)</p>
            </div>
            <div className={`flex-1 overflow-y-auto p-4 ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`} style={{scrollbarWidth:'thin'}}>
              {isSearching ? (
                <div className="h-full flex flex-col items-center justify-center opacity-60">
                  <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin mb-3"/>
                  <p className="text-sm font-bold text-gray-400">도서관에서 책을 찾고 있어요...</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-60">
                  <BookOpen className="w-12 h-12 text-gray-300 mb-3"/>
                  <p className="text-sm font-bold text-gray-400 text-center">
                    {hasSearched ? <>검색 결과가 없어요.<br/>다른 검색어로 찾아보세요!</> : <>도서관에서 책을 찾아올게요!<br/>제목이나 저자 이름을 입력해 보세요.</>}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {searchResults.map((book, i) => (
                    <div key={i} className={`flex gap-4 p-3 rounded-2xl border shadow-sm hover:shadow-md transition-shadow ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                      <div className="w-16 h-24 rounded-lg overflow-hidden flex-shrink-0 border border-gray-100">
                        <BookCover thumbnail={book.thumbnail}/>
                      </div>
                      <div className="flex-1 flex flex-col py-1">
                        <h4 className={`font-bold text-sm leading-snug mb-1 ${tTextMain}`} style={{overflow:'hidden',display:'-webkit-box',WebkitBoxOrient:'vertical',WebkitLineClamp:2}}>{book.title}</h4>
                        <p className={`text-xs ${tTextSub}`}>{book.author}</p>
                        <p className={`text-[10px] mt-1 ${tTextSub}`}>총 {book.totalPage}쪽</p>
                        <button onClick={() => addBook(book)} className="mt-auto self-start text-xs font-bold bg-orange-100 text-orange-600 px-4 py-1.5 rounded-lg hover:bg-orange-200 transition-colors">서재에 추가</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 진도 업데이트 모달 ───────────────────────────────────── */}
      {isBookModalOpen && selectedBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsBookModalOpen(false)}>
          <div className={`rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden p-6 border-4 border-white/50 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
            <div className="flex justify-end mb-2">
              <button onClick={() => setIsBookModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6"/></button>
            </div>
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-24 h-36 rounded-xl shadow-lg overflow-hidden mb-4 border border-gray-200">
                <BookCover thumbnail={selectedBook.thumbnail} className="w-full h-full"/>
              </div>
              <h3 className={`text-lg font-black leading-tight mb-1 ${tTextMain}`}>{selectedBook.title}</h3>
              <p className={`text-sm ${tTextSub}`}>{selectedBook.author}</p>
              {selectedBook.status === 'completed' && (
                <span className="mt-2 text-[10px] font-bold bg-green-100 text-green-700 px-3 py-1 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3"/> 완독 완료 ({selectedBook.endDate})
                </span>
              )}
            </div>
            <form onSubmit={updateProgress} className="space-y-4">
              <div className={`p-4 rounded-2xl border-2 ${isDark ? 'border-gray-700' : 'bg-amber-50/50 border-amber-100'}`}>
                <label className={`block text-xs font-bold mb-2 ${tTextSub}`}>어디까지 읽으셨나요?</label>
                <div className="flex items-center gap-2">
                  <input type="number" value={readPagesInput} onChange={e => setReadPagesInput(e.target.value)} className={`flex-1 text-center font-black text-xl px-4 py-3 rounded-xl border-2 outline-none ${tInput}`}/>
                  <span className={`font-bold ${tTextSub}`}>/ {selectedBook.totalPage}p</span>
                </div>
                <input type="range" min="0" max={selectedBook.totalPage} value={readPagesInput} onChange={e => setReadPagesInput(e.target.value)} className="w-full mt-4 accent-orange-500 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"/>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => deleteBook(selectedBook.id)} className={`flex-1 py-3.5 rounded-2xl text-sm font-bold border-2 transition-colors ${isDark ? 'border-gray-600 text-gray-400 hover:bg-gray-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>삭제</button>
                <button type="submit" className="flex-[2] bg-orange-500 hover:bg-orange-600 text-white py-3.5 rounded-2xl text-sm font-bold shadow-md transition-all active:scale-95">진도 저장하기</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
