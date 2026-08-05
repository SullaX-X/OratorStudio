/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { topics } from './data/topics';
import { Play, Pause, RotateCcw, Shuffle, History, X, Trash2, Maximize, Minimize, Volume2, VolumeX, Moon, Sun, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type HistoryItem = {
  topic: typeof topics[0];
  duration: number;
  timestamp: number;
  date: string;
};

export default function App() {
  const [timerDuration, setTimerDuration] = useState<number>(60);
  const [currentTopic, setCurrentTopic] = useState(topics[0]);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [prepTimeLeft, setPrepTimeLeft] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isPrepRunning, setIsPrepRunning] = useState<boolean>(false);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const isPrepRunningRef = useRef(false);
  const isRunningRef = useRef(false);

  useEffect(() => {
    isPrepRunningRef.current = isPrepRunning;
    isRunningRef.current = isRunning;
  }, [isPrepRunning, isRunning]);

  // Track spinning state for key rendering
  const [spinKey, setSpinKey] = useState(0);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<any>(null);
  const workerRef = useRef<Worker | null>(null);
  
  const shuffleBtnRef = useRef<HTMLButtonElement>(null);
  const playBtnRef = useRef<HTMLButtonElement>(null);
  const resetBtnRef = useRef<HTMLButtonElement>(null);

  // Initialize Web Worker
  useEffect(() => {
    workerRef.current = new Worker(new URL('./timerWorker.ts', import.meta.url), { type: 'module' });
    
    workerRef.current.onmessage = (e) => {
      if (e.data === 'tick') {
        if (isPrepRunningRef.current) {
          setPrepTimeLeft((prev) => {
            if (prev <= 1) {
              setIsPrepRunning(false);
              setIsRunning(true);
              return 0;
            }
            return prev - 1;
          });
        } else if (isRunningRef.current) {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              setIsRunning(false);
              playEndSound();
              workerRef.current?.postMessage('stop');
              return 0;
            }
            return prev - 1;
          });
        }
      }
    };

    return () => {
      workerRef.current?.postMessage('stop');
      workerRef.current?.terminate();
    };
  }, []);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
      }
    }
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const playTickSound = () => {
    if (isMuted) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    
    try {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.03);
      
      gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.03);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.03);
    } catch (e) {}
  };

  const playEndSound = () => {
    if (isMuted) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    
    try {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc1.type = 'sine';
      osc2.type = 'sine';
      
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc2.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 1.5);
      osc2.stop(ctx.currentTime + 1.5);
    } catch (e) {}
  };

  const generateTopic = () => {
    if (isSpinning) return;
    initAudio();
    setIsSpinning(true);
    setIsRunning(false);
    
    const finalTopic = topics[Math.floor(Math.random() * topics.length)];
    
    let spins = 0;
    const maxSpins = 20;
    let currentInterval = 30;
    
    const spin = () => {
      spins++;
      // Make sure we don't pick the final topic until the end
      let randomTopic = topics[Math.floor(Math.random() * topics.length)];
      if (spins === maxSpins - 1 && randomTopic.main === finalTopic.main) {
        randomTopic = topics[(topics.indexOf(randomTopic) + 1) % topics.length];
      }
      
      setCurrentTopic(randomTopic);
      setSpinKey(prev => prev + 1);
      playTickSound();
      
      if (spins < maxSpins) {
        // Starts fast, slows down exponentially
        currentInterval = 30 + Math.pow(spins, 1.8) * 1.5;
        window.setTimeout(spin, currentInterval);
      } else {
        setCurrentTopic(finalTopic);
        setSpinKey(prev => prev + 1);
        setIsSpinning(false);
        setHistory(prev => {
          if (prev.length > 0 && prev[0].topic.main === finalTopic.main) return prev;
          const newItem: HistoryItem = {
            topic: finalTopic,
            duration: timerDuration,
            timestamp: Date.now(),
            date: new Date().toLocaleDateString()
          };
          return [newItem, ...prev].slice(0, 50); // Keep last 50
        });
        setTimeLeft(timerDuration);
        setPrepTimeLeft(0);
        setIsPrepRunning(false);
      }
    };
    
    window.setTimeout(spin, currentInterval);
  };

  const toggleTimer = () => {
    if (isSpinning) return;
    initAudio();
    
    if (!isRunning && !isPrepRunning) {
      if (timeLeft === timerDuration) {
        setPrepTimeLeft(5);
        setIsPrepRunning(true);
        workerRef.current?.postMessage('start');
      } else {
        setIsRunning(true);
        workerRef.current?.postMessage('start');
      }
    } else {
      setIsRunning(false);
      setIsPrepRunning(false);
      workerRef.current?.postMessage('stop');
    }
  };

  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setIsPrepRunning(false);
    setTimeLeft(timerDuration);
    setPrepTimeLeft(0);
    workerRef.current?.postMessage('stop');
  }, [timerDuration]);

  const clearHistory = () => {
    setHistory([]);
    setShowClearConfirm(false);
  };

  const downloadHistory = () => {
    if (history.length === 0) return;
    
    const text = history.map((item, index) => {
      return `${history.length - index}. ${item.topic.main}\n   ${item.topic.sub}\n   Дата: ${item.date}, Время: ${Math.round(item.duration / 60)} мин`;
    }).join('\n\n');
    
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orator-history-${new Date().toLocaleDateString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Wake Lock API (Keep screen awake while speaking)
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && (isRunning || isPrepRunning)) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {}
    };
    
    if (isRunning || isPrepRunning) requestWakeLock();
    else if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
    
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [isRunning]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showHistory) return;
      
      if (e.code === 'Space') {
        e.preventDefault();
        playBtnRef.current?.click();
      } else if (e.code === 'Enter') {
        e.preventDefault();
        shuffleBtnRef.current?.click();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        resetBtnRef.current?.click();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        setIsMuted(prev => !prev);
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showHistory]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const progressPercent = timeLeft > 0 ? ((timerDuration - timeLeft) / timerDuration) * 100 : 100;
  
  const bgClass = isDarkMode ? "bg-black" : "bg-white";
  const textClass = isDarkMode ? "text-white" : "text-black";
  const textMutedClass = isDarkMode ? "text-neutral-500" : "text-neutral-400";
  const borderClass = isDarkMode ? "border-neutral-800" : "border-neutral-200";
  const borderHoverClass = isDarkMode ? "hover:border-white" : "hover:border-black";
  const bgHoverClass = isDarkMode ? "hover:bg-white/10" : "hover:bg-black/5";
  const overlayClass = isDarkMode ? "bg-black/80" : "bg-black/10";
  const panelBgClass = isDarkMode ? "bg-[#0a0a0a]" : "bg-white";

  const todayStr = new Date().toLocaleDateString();
  const todayStats = history.filter(h => h.date === todayStr);
  const totalMinutes = Math.round(todayStats.reduce((sum, h) => sum + h.duration, 0) / 60);

  return (
    <div className={`min-h-[100dvh] ${bgClass} ${textClass} font-sans flex flex-col selection:bg-white/10 overflow-hidden relative transition-colors duration-500`}>
      
      {/* Progress Bar */}
      <div className={`absolute top-0 left-0 w-full h-[2px] ${isDarkMode ? 'bg-white/10' : 'bg-black/10'} z-50 transition-opacity duration-500 ${(isRunning || timeLeft < timerDuration) && !isPrepRunning ? 'opacity-100' : 'opacity-0'}`}>
        <div 
          className={`h-full ${isDarkMode ? 'bg-white' : 'bg-black'} transition-all ease-linear`}
          style={{ 
            width: `${progressPercent}%`,
            transitionDuration: isRunning ? '1000ms' : '300ms'
          }}
        />
      </div>

      {/* Header */}
      <header className="w-full p-6 md:p-8 flex justify-between items-center z-10">
        <div className="font-bold tracking-[0.2em] uppercase text-xs opacity-70">
          Orator Studio
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)} 
            className={`p-2 ${textMutedClass} ${textClass.replace('text-', 'hover:text-')} ${bgHoverClass} rounded-full transition-colors`}
            title={isDarkMode ? "Светлая тема" : "Темная тема"}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button 
            onClick={() => setIsMuted(!isMuted)} 
            className={`p-2 ${textMutedClass} ${textClass.replace('text-', 'hover:text-')} ${bgHoverClass} rounded-full transition-colors`}
            title={isMuted ? "Включить звук (M)" : "Выключить звук (M)"}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button 
            onClick={toggleFullscreen} 
            className={`p-2 ${textMutedClass} ${textClass.replace('text-', 'hover:text-')} ${bgHoverClass} rounded-full transition-colors`}
            title={isFullscreen ? "Свернуть (F)" : "На весь экран (F)"}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <button 
            onClick={() => setShowHistory(true)} 
            className={`ml-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-80 hover:opacity-100 transition-opacity`}
            title="История тем"
          >
            <History size={16} />
            <span className="hidden sm:inline">История</span>
          </button>
        </div>
      </header>

      {/* Main Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 w-full max-w-5xl mx-auto z-0 overflow-y-auto hide-scrollbar">
        
        {/* Barrel / Roulette Area */}
        <div 
          className="w-full h-[200px] sm:h-[240px] md:h-[300px] relative flex items-center justify-center mask-vertical-fade mt-auto"
          style={{ perspective: '1000px' }}
        >
          <AnimatePresence mode="popLayout">
            <motion.div
              key={spinKey}
              initial={{ y: '60%', opacity: 0, rotateX: -60, scale: 0.9, filter: 'blur(3px)' }}
              animate={{ y: '0%', opacity: 1, rotateX: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ y: '-60%', opacity: 0, rotateX: 60, scale: 0.9, filter: 'blur(3px)' }}
              transition={{ 
                duration: isSpinning ? 0.12 : 0.8, 
                ease: isSpinning ? "linear" : [0.16, 1, 0.3, 1] // Custom spring-like ease for final stop
              }}
              style={{ transformStyle: 'preserve-3d' }}
              className="absolute w-full flex flex-col items-center justify-center text-center px-4"
            >
              <h1 className={`text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tighter mb-2 sm:mb-4 md:mb-6 uppercase leading-[1.1] max-w-4xl ${textClass} break-words w-full px-2`}>
                {currentTopic.main}
              </h1>
              <p className={`text-lg sm:text-xl md:text-3xl ${textMutedClass} max-w-2xl font-light px-2`}>
                {currentTopic.sub}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Timer Options */}
        <div className="mt-4 sm:mt-8 md:mt-12 flex flex-wrap justify-center gap-4 md:gap-6 z-10 px-4">
          {[30, 60, 120, 300].map(duration => (
             <button
                key={duration}
                onClick={() => {
                  setTimerDuration(duration);
                  setIsRunning(false);
                  setTimeLeft(duration);
                }}
                disabled={isSpinning}
                className={`text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-colors pb-1 disabled:opacity-30 ${
                  timerDuration === duration 
                    ? 'text-black border-b-2 border-black' 
                    : 'text-neutral-400 hover:text-black'
                }`}
             >
                {duration >= 60 ? `${duration / 60} мин` : `${duration} сек`}
             </button>
          ))}
        </div>

        {/* Timer */}
        <div className="relative mt-4 sm:mt-6 md:mt-8 flex justify-center items-center h-[6rem] sm:h-[8rem] md:h-[10rem] lg:h-[12rem]">
          <AnimatePresence mode="wait">
            {isPrepRunning ? (
              <motion.div
                key="prep"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                className={`text-[4rem] sm:text-[5.5rem] md:text-[7rem] lg:text-[8rem] tabular-nums tracking-tighter leading-none font-medium animate-pulse ${textMutedClass}`}
              >
                00:0{prepTimeLeft}
              </motion.div>
            ) : (
              <motion.div
                key="main"
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`text-[4rem] sm:text-[5.5rem] md:text-[7rem] lg:text-[8rem] tabular-nums tracking-tighter leading-none font-medium transition-colors duration-500 ${
                  timeLeft <= 10 && timeLeft > 0 && isRunning ? `${textClass} scale-105 opacity-80` : textClass
                }`}
              >
                {formatTime(timeLeft)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Minimal Controls */}
        <div className="mt-8 sm:mt-12 md:mt-16 mb-6 sm:mb-12 flex items-center justify-center gap-6 sm:gap-8 w-full max-w-md mt-auto">
          <button
            ref={resetBtnRef}
            onClick={resetTimer}
            disabled={isSpinning || (timeLeft === timerDuration && !isRunning && !isPrepRunning)}
            className={`w-14 h-14 sm:w-20 sm:h-20 flex items-center justify-center rounded-full border ${borderClass} ${borderHoverClass} transition-colors disabled:opacity-30 disabled:${borderClass}`}
            title="Сброс (Клавиша: R)"
          >
            <RotateCcw size={24} strokeWidth={1.5} />
          </button>
          
          <button
            ref={playBtnRef}
            onClick={toggleTimer}
            disabled={isSpinning || (timeLeft === 0 && !isPrepRunning)}
            className={`w-20 h-20 sm:w-28 sm:h-28 flex items-center justify-center rounded-full transition-all border ${
              isRunning || isPrepRunning
                ? `${isDarkMode ? 'bg-white text-black border-white' : 'bg-black text-white border-black'}` 
                : `${isDarkMode ? 'bg-black text-white border-white hover:bg-white/10' : 'bg-white text-black border-black hover:bg-black/5'}`
            } disabled:opacity-30`}
            title="Старт / Пауза (Клавиша: Пробел)"
          >
            {isRunning || isPrepRunning ? <Pause size={36} strokeWidth={1.5} /> : <Play size={36} strokeWidth={1.5} className="ml-2" />}
          </button>

          <button
            ref={shuffleBtnRef}
            onClick={generateTopic}
            disabled={isSpinning}
            className={`w-14 h-14 sm:w-20 sm:h-20 flex items-center justify-center rounded-full border ${borderClass} ${borderHoverClass} transition-colors disabled:opacity-30 disabled:${borderClass} relative overflow-hidden group`}
            title="Новая тема (Клавиша: Enter)"
          >
            <Shuffle size={24} strokeWidth={1.5} className="relative z-10 transition-transform group-active:rotate-180 duration-500" />
          </button>
        </div>
      </main>

      {/* History Overlay */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className={`absolute inset-0 ${overlayClass} backdrop-blur-sm z-40`}
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className={`absolute top-0 right-0 bottom-0 w-full md:w-[400px] ${panelBgClass} border-l ${borderClass} z-50 flex flex-col`}
            >
              <div className={`p-6 border-b ${borderClass} flex justify-between items-center ${panelBgClass}`}>
                <h3 className="text-xs font-bold uppercase tracking-[0.2em]">История тем</h3>
                <div className="flex items-center gap-2">
                  {history.length > 0 && (
                    <>
                      <button 
                        onClick={downloadHistory}
                        className={`p-2 ${bgHoverClass} rounded-full transition-colors ${textMutedClass} ${textClass.replace('text-', 'hover:text-')}`}
                        title="Скачать историю"
                      >
                        <Download size={18} />
                      </button>
                      <button 
                        onClick={() => setShowClearConfirm(true)}
                        className={`p-2 ${bgHoverClass} rounded-full transition-colors ${textMutedClass} ${textClass.replace('text-', 'hover:text-')}`}
                        title="Очистить историю"
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                  <button 
                    onClick={() => {
                      setShowHistory(false);
                      setShowClearConfirm(false);
                    }}
                    className={`p-2 ${bgHoverClass} rounded-full transition-colors`}
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Activity Stats */}
              {history.length > 0 && (
                <div className={`m-6 p-4 rounded-xl ${isDarkMode ? 'bg-white/5' : 'bg-black/5'} flex justify-between items-center`}>
                  <div className="flex flex-col">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${textMutedClass} mb-1`}>Сегодня</span>
                    <span className={`font-medium ${textClass}`}>{todayStats.length} тем / {totalMinutes} мин</span>
                  </div>
                </div>
              )}

              <div className={`flex-1 overflow-y-auto hide-scrollbar px-6 pb-6 flex flex-col gap-6 ${panelBgClass} relative`}>
                <AnimatePresence>
                  {showClearConfirm && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className={`absolute inset-0 ${isDarkMode ? 'bg-[#0a0a0a]/95' : 'bg-white/95'} backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 text-center`}
                    >
                      <p className={`text-lg font-medium mb-6 ${textClass}`}>Очистить историю тем?</p>
                      <div className="flex gap-4 w-full max-w-[240px]">
                        <button 
                          onClick={() => setShowClearConfirm(false)}
                          className={`flex-1 py-3 px-4 border ${borderClass} rounded-lg ${borderHoverClass} transition-colors text-sm font-medium ${textClass}`}
                        >
                          Отмена
                        </button>
                        <button 
                          onClick={clearHistory}
                          className={`flex-1 py-3 px-4 ${isDarkMode ? 'bg-white text-black hover:bg-neutral-200' : 'bg-black text-white hover:bg-neutral-800'} rounded-lg transition-colors text-sm font-medium`}
                        >
                          Очистить
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {history.length === 0 ? (
                  <p className={`${textMutedClass} text-sm font-light text-center mt-10`}>
                    История пуста
                  </p>
                ) : (
                  history.map((item, i) => (
                    <div key={i} className={`flex flex-col border-l-2 ${borderClass} pl-4 py-1 ${borderHoverClass} transition-colors group`}>
                      <span className={`text-xs ${textMutedClass} mb-1`}>
                        #{history.length - i}
                      </span>
                      <h4 className={`text-lg font-bold uppercase tracking-tight ${textClass}`}>
                        {item.topic.main}
                      </h4>
                      <p className={`text-sm ${textMutedClass} font-light`}>
                        {item.topic.sub}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
