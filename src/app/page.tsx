'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { playDingSound } from './sounds';

interface Timer {
  id: number;
  number: string;
  initialTime: number; // 秒
  startTime: number;   // 时间戳
  expiresAt: number;   // 时间戳
}

interface Toast {
  id: number;
  message: string;
}

const DEFAULT_HOURS = 2;
const DEFAULT_MINUTES = 0;
const STORAGE_KEY = 'countdown-timers-v3';
const NUMBERS = Array.from({ length: 20 }, (_, i) => String(i).padStart(2, '0'));

function timeLeftOf(timer: Timer): number {
  return Math.max(0, Math.floor((timer.expiresAt - Date.now()) / 1000));
}

export default function Home() {
  const [timers, setTimers] = useState<Timer[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [tick, setTick] = useState(0);

  const showToast = useCallback((message: string) => {
    const newToast = { id: Date.now(), message };
    setToasts(prev => [...prev, newToast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== newToast.id));
    }, 3000);
  }, []);

  // 从 localStorage 加载
  useEffect(() => {
    try {
      const savedTimers = localStorage.getItem(STORAGE_KEY);
      if (savedTimers) {
        const parsedTimers: Timer[] = JSON.parse(savedTimers);
        const now = Date.now();
        const anyExpired = parsedTimers.some(
          t => t.expiresAt <= now && t.expiresAt > now - 5000
        );
        if (anyExpired) playDingSound();
        setTimers(parsedTimers);
      }
    } catch (error) {
      console.error('Failed to parse timers from localStorage', error);
    }
  }, []);

  // 监听其他窗口的 storage 事件
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue !== null) {
        try {
          const newTimers = JSON.parse(event.newValue);
          setTimers(newTimers);
        } catch (error) {
          console.error('Failed to parse timers from storage event', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 全局 tick：有活跃计时器时每秒刷新 UI
  useEffect(() => {
    const hasActive = timers.some(t => timeLeftOf(t) > 0);
    if (!hasActive) return;

    const interval = setInterval(() => {
      setTick(v => v + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timers]);

  // 仅当 timers 数组变化时写 localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
  }, [timers]);

  const handleAddTimer = () => {
    if (!selectedNumber) {
      showToast('请先选择一个编号');
      return;
    }

    if (timers.some(t => t.number === selectedNumber)) {
      showToast(`编号 ${selectedNumber} 已在倒计时中`);
      return;
    }

    const totalSeconds = hours * 3600 + minutes * 60;
    const now = Date.now();
    const newTimer: Timer = {
      id: now,
      number: selectedNumber,
      initialTime: totalSeconds > 0 ? totalSeconds : 1,
      startTime: now,
      expiresAt: now + totalSeconds * 1000,
    };

    setTimers(prev => [...prev, newTimer]);
    setSelectedNumber(null);
    setHours(DEFAULT_HOURS);
    setMinutes(DEFAULT_MINUTES);
  };

  const handleRemoveTimer = (id: number) => {
    setTimers(prev => prev.filter(timer => timer.id !== id));
  };

  const handleResetTimer = (id: number) => {
    const now = Date.now();
    setTimers(prev =>
      prev.map(timer =>
        timer.id === id
          ? { ...timer, startTime: now, expiresAt: now + timer.initialTime * 1000 }
          : timer
      )
    );
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [
      String(h).padStart(2, '0'),
      String(m).padStart(2, '0'),
      String(s).padStart(2, '0'),
    ].join(':');
  };

  const formatStartTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const sortedTimers = useMemo(() => {
    return [...timers].sort((a, b) => timeLeftOf(a) - timeLeftOf(b));
  }, [timers, tick]);

  const progress = (secondsLeft: number, initialTime: number) => {
    if (initialTime === 0) return 0;
    return Math.max(0, Math.min(100, (secondsLeft / initialTime) * 100));
  };

  return (
    <main className="min-h-screen bg-[#F7F8FA] text-slate-800 px-4 py-8 sm:px-8 sm:py-12">
      {/* 背景渐变 */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#F7F8FA] via-white to-[#F0F4F8]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-teal-300/20 rounded-full blur-[120px]" />
      </div>

      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-3">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="animate-slideIn flex items-center gap-3 rounded-xl bg-white/90 backdrop-blur-md border border-slate-200/70 px-4 py-3 shadow-lg"
          >
            <span className="inline-flex h-2 w-2 rounded-full bg-teal-500" />
            <span className="text-sm font-medium text-slate-700">{toast.message}</span>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-4xl">
        {/* 标题 */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight bg-gradient-to-r from-slate-800 to-slate-500 bg-clip-text text-transparent">
            SlimeLand 计时器
          </h1>
          <p className="mt-2 text-slate-500 text-sm sm:text-base font-light">
            选择编号，设定时间，开始倒计时。
          </p>
        </div>

        {/* 编号选择器 */}
        <div className="mb-8 rounded-2xl border border-slate-200/70 bg-white/60 backdrop-blur-sm p-5 sm:p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">选择编号</span>
            {selectedNumber && (
              <span className="text-xs font-semibold text-teal-600">
                已选：{selectedNumber}
              </span>
            )}
          </div>
          <div className="grid grid-cols-5 gap-2 sm:gap-3">
            {NUMBERS.map(num => {
              const isSelected = selectedNumber === num;
              const isActive = timers.some(t => t.number === num);
              return (
                <button
                  key={num}
                  onClick={() => !isActive && setSelectedNumber(num)}
                  disabled={isActive}
                  className={[
                    'relative h-12 sm:h-14 rounded-xl text-sm sm:text-base font-medium transition-all duration-200',
                    isSelected
                      ? 'bg-teal-500 text-white shadow-[0_0_20px_rgba(20,184,166,0.35)]'
                      : isActive
                      ? 'bg-slate-200/70 text-slate-400 cursor-not-allowed'
                      : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800 border border-slate-200 shadow-sm',
                  ].join(' ')}
                >
                  {num}
                  {isActive && (
                    <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-slate-300" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 时间输入 & 添加 */}
        <div className="mb-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200/70 bg-white/60 backdrop-blur-sm px-5 py-4 shadow-sm">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={23}
                value={hours}
                onChange={e => setHours(Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0)))}
                className="h-12 w-20 rounded-xl bg-slate-50 text-center text-2xl font-medium text-slate-800 outline-none ring-0 border border-slate-200 focus:border-teal-500/60 transition-colors"
              />
              <span className="text-slate-500 text-sm font-medium">时</span>
            </div>
            <span className="text-slate-300 text-xl">:</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={e => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                className="h-12 w-20 rounded-xl bg-slate-50 text-center text-2xl font-medium text-slate-800 outline-none ring-0 border border-slate-200 focus:border-teal-500/60 transition-colors"
              />
              <span className="text-slate-500 text-sm font-medium">分</span>
            </div>
          </div>

          <button
            onClick={handleAddTimer}
            className="w-full h-16 sm:h-[58px] rounded-2xl sm:rounded-xl bg-teal-500 text-white font-semibold text-lg transition-all duration-200 hover:bg-teal-400 hover:shadow-[0_0_24px_rgba(20,184,166,0.35)] active:scale-[0.98]"
          >
            添加计时器
          </button>
        </div>

        {/* 计时器列表 */}
        <div className="flex flex-col gap-4">
          {sortedTimers.map(timer => {
            const tl = timeLeftOf(timer);
            const pct = progress(tl, timer.initialTime);
            const isDone = tl === 0;
            return (
              <div
                key={timer.id}
                className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/70 backdrop-blur-sm transition-all duration-300 hover:border-teal-200/60 hover:bg-white shadow-sm"
              >
                {/* 进度条 */}
                <div
                  className="absolute bottom-0 left-0 h-1.5 transition-all duration-1000"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: isDone ? '#f43f5e' : '#2dd4bf',
                    opacity: 0.9,
                  }}
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-lg font-semibold text-slate-700">
                      {timer.number}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                          {formatStartTime(timer.startTime)} 开始
                        </span>
                        <span className="text-xs text-slate-300">•</span>
                        <span className="text-xs text-slate-400">
                          共 {formatTime(timer.initialTime)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={[
                            'inline-block h-2 w-2 rounded-full',
                            isDone ? 'bg-rose-500 animate-pulse' : 'bg-teal-400',
                          ].join(' ')}
                        />
                        <span
                          className={[
                            'text-sm font-medium',
                            isDone ? 'text-rose-500' : 'text-teal-600',
                          ].join(' ')}
                        >
                          {isDone ? '时间到' : '进行中'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-4 sm:ml-auto">
                    <div
                      className={[
                        'text-3xl sm:text-4xl font-medium tracking-tight tabular-nums',
                        isDone ? 'text-rose-500' : 'text-slate-800',
                      ].join(' ')}
                    >
                      {formatTime(tl)}
                    </div>
                    <button
                      onClick={() => handleRemoveTimer(timer.id)}
                      className="h-8 px-3 rounded-md bg-rose-50 text-xs font-medium text-rose-500 transition-all duration-200 hover:bg-rose-100 active:scale-[0.98]"
                    >
                      移除
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 空状态 */}
        {timers.length === 0 && (
          <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 border border-slate-200">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-slate-400"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <p className="text-slate-600 font-medium">暂无计时器</p>
            <p className="mt-1 text-sm text-slate-400">选择一个编号并添加计时器即可开始。</p>
          </div>
        )}
      </div>
    </main>
  );
}
