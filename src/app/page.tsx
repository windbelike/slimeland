'use client';

import { useState, useEffect, useCallback } from 'react';
import { playDingSound } from './sounds';

interface Timer {
  id: number;
  number: string;
  initialTime: number;
  startTime: number;
  expiresAt: number;
}

interface Toast {
  id: number;
  message: string;
}

const DEFAULT_HOURS = 2;
const DEFAULT_MINUTES = 0;
const NUMBERS = Array.from({ length: 20 }, (_, i) => String(i).padStart(2, '0'));

function timeLeftOf(timer: Timer): number {
  return Math.max(0, Math.floor((timer.expiresAt - Date.now()) / 1000));
}

function getDayKey(timestamp: number = Date.now()): string {
  const date = new Date(timestamp);
  const hours = date.getHours();
  if (hours < 6) {
    const prev = new Date(timestamp - 24 * 60 * 60 * 1000);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDayLabel(dayKey: string): string {
  const today = getDayKey();
  const yesterdayKey = (() => {
    const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const h = d.getHours();
    if (h < 6) {
      const p = new Date(d.getTime() - 24 * 60 * 60 * 1000);
      return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}-${String(p.getDate()).padStart(2, '0')}`;
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  if (dayKey === today) return '今天';
  if (dayKey === yesterdayKey) return '昨天';
  return dayKey;
}

export default function Home() {
  const [timers, setTimers] = useState<Timer[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [tick, setTick] = useState(0);
  const [currentDay, setCurrentDay] = useState<string>(getDayKey());
  const [historyDays, setHistoryDays] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDayMenu, setShowDayMenu] = useState(false);

  const showToast = useCallback((message: string) => {
    const newToast = { id: Date.now(), message };
    setToasts(prev => [...prev, newToast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== newToast.id));
    }, 3000);
  }, []);

  const loadTimers = useCallback(async (day: string) => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/timers?day=${day}`);
      const data = (await res.json()) as { timers: Timer[]; dayKey: string };
      const loadedTimers: Timer[] = data.timers || [];

      const now = Date.now();
      const anyExpired = loadedTimers.some(
        t => t.expiresAt <= now && t.expiresAt > now - 5000
      );
      if (anyExpired) playDingSound();

      setTimers(loadedTimers);
      setCurrentDay(day);
    } catch (error) {
      console.error('Failed to load timers:', error);
      showToast('加载失败，请重试');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/timers/history');
      const data = (await res.json()) as { days: string[] };
      setHistoryDays(data.days || []);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  }, []);

  useEffect(() => {
    loadTimers(getDayKey());
    loadHistory();
  }, [loadTimers, loadHistory]);

  useEffect(() => {
    const hasActive = timers.some(t => timeLeftOf(t) > 0);
    if (!hasActive) return;

    const interval = setInterval(() => {
      setTick(v => v + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timers]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadTimers(currentDay);
    }, 8000);
    return () => clearInterval(interval);
  }, [currentDay, loadTimers]);

  const handleAddTimer = async () => {
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

    try {
      const res = await fetch('/api/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timer: newTimer, dayKey: currentDay }),
      });
      const data = (await res.json()) as { success: boolean; timers: Timer[] };
      if (data.success) {
        setTimers(data.timers);
        setSelectedNumber(null);
        setHours(DEFAULT_HOURS);
        setMinutes(DEFAULT_MINUTES);
        showToast(`编号 ${newTimer.number} 的计时器添加成功`);
        loadHistory();
      } else {
        showToast('添加失败，请重试');
      }
    } catch (error) {
      console.error('Add timer error:', error);
      showToast('添加失败，请重试');
    }
  };

  const handleRemoveTimer = async (id: number, number: string) => {
    try {
      const res = await fetch(`/api/timers?id=${id}&day=${currentDay}`, {
        method: 'DELETE',
      });
      const data = (await res.json()) as { success: boolean; timers: Timer[] };
      if (data.success) {
        setTimers(data.timers);
        showToast(`编号 ${number} 已移除`);
      } else {
        showToast('移除失败，请重试');
      }
    } catch (error) {
      console.error('Remove timer error:', error);
      showToast('移除失败，请重试');
    }
  };

  const handleSwitchDay = (day: string) => {
    loadTimers(day);
    setShowDayMenu(false);
  };

  useEffect(() => {
    if (!showDayMenu) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-day-menu]')) {
        setShowDayMenu(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showDayMenu]);

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

  const sortedTimers = (() => {
    return [...timers].sort((a, b) => timeLeftOf(a) - timeLeftOf(b));
  })();

  const progress = (secondsLeft: number, initialTime: number) => {
    if (initialTime === 0) return 0;
    return Math.max(0, Math.min(100, (secondsLeft / initialTime) * 100));
  };

  return (
    <main className="min-h-screen bg-[#FDF2F4] text-slate-900 px-4 py-8 sm:px-8 sm:py-12">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-3">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="animate-slideIn flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-lg border border-slate-100"
          >
            <span className="inline-flex h-2 w-2 rounded-full bg-pink-500" />
            <span className="text-sm font-medium text-slate-800">{toast.message}</span>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-4xl">
        {/* 标题 */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900">
            SlimeLand 计时器
          </h1>
          <p className="mt-2 text-slate-500 text-sm sm:text-base font-light">
            选择编号，设定时间，开始倒计时
          </p>
        </div>

        {/* 日期切换 */}
        <div className="mb-6" data-day-menu>
          <button
            onClick={() => setShowDayMenu(v => !v)}
            className="w-full flex items-center justify-between rounded-2xl bg-white px-5 py-4 shadow-sm transition-all hover:shadow-md border border-slate-100"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 text-pink-500">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-slate-900">
                  {formatDayLabel(currentDay)}
                </div>
                <div className="text-xs text-slate-400">
                  每天凌晨 6 点开启新的一天
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {historyDays.length > 0 && (
                <span className="text-xs font-medium text-pink-600 bg-pink-50 px-2.5 py-1 rounded-full">
                  {historyDays.length + 1} 天记录
                </span>
              )}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={['text-slate-400 transition-transform duration-200', showDayMenu ? 'rotate-180' : ''].join(' ')}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>

          {showDayMenu && (
            <div className="mt-2 rounded-2xl bg-white shadow-lg border border-slate-100 overflow-hidden">
              <div className="max-h-64 overflow-y-auto py-1">
                <button
                  onClick={() => handleSwitchDay(getDayKey())}
                  className={[
                    'w-full text-left px-5 py-3 text-sm font-medium transition-colors',
                    currentDay === getDayKey() ? 'bg-pink-50 text-pink-600' : 'text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between">
                    <span>今天</span>
                    {currentDay === getDayKey() && (
                      <span className="h-2 w-2 rounded-full bg-pink-500" />
                    )}
                  </div>
                </button>
                {historyDays
                  .filter(day => day !== getDayKey())
                  .map(day => (
                  <button
                    key={day}
                    onClick={() => handleSwitchDay(day)}
                    className={[
                      'w-full text-left px-5 py-3 text-sm font-medium transition-colors',
                      currentDay === day ? 'bg-pink-50 text-pink-600' : 'text-slate-700 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between">
                      <span>{formatDayLabel(day)}</span>
                      {currentDay === day && (
                        <span className="h-2 w-2 rounded-full bg-pink-500" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 编号选择器 */}
        <div className="mb-8 rounded-2xl bg-white p-5 sm:p-6 shadow-sm border border-slate-100">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">选择编号</span>
            {selectedNumber && (
              <span className="text-xs font-semibold text-pink-600 bg-pink-50 px-3 py-1 rounded-full">
                已选 {selectedNumber}
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
                      ? 'bg-pink-500 text-white shadow-md shadow-pink-200'
                      : isActive
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200',
                  ].join(' ')}
                >
                  {num}
                  {isActive && (
                    <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-slate-300" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 时间输入 & 添加 */}
        <div className="mb-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="flex items-center justify-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={23}
                value={hours}
                onChange={e => setHours(Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0)))}
                className="h-12 w-20 rounded-xl bg-slate-50 text-center text-2xl font-semibold text-slate-900 outline-none ring-0 border border-slate-200 focus:border-pink-400 transition-colors"
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
                className="h-12 w-20 rounded-xl bg-slate-50 text-center text-2xl font-semibold text-slate-900 outline-none ring-0 border border-slate-200 focus:border-pink-400 transition-colors"
              />
              <span className="text-slate-500 text-sm font-medium">分</span>
            </div>
          </div>

          <button
            onClick={handleAddTimer}
            disabled={isLoading}
            className="w-full h-16 sm:h-[58px] rounded-xl bg-pink-500 text-white font-semibold text-lg transition-all duration-200 hover:bg-pink-600 hover:shadow-lg hover:shadow-pink-200 active:scale-[0.98] disabled:opacity-60"
          >
            {isLoading ? '加载中...' : '添加计时器'}
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
                className="group relative overflow-hidden rounded-2xl bg-white transition-all duration-300 hover:shadow-md border border-slate-100"
              >
                {/* 进度条 */}
                <div
                  className="absolute bottom-0 left-0 h-1.5 transition-all duration-1000"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: isDone ? '#f43f5e' : '#ec4899',
                    opacity: 0.85,
                  }}
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-lg font-bold text-slate-900">
                      {timer.number}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-500">
                          {formatStartTime(timer.startTime)} 开始
                        </span>
                        <span className="text-xs text-slate-300">•</span>
                        <span className="text-xs text-slate-500">
                          共 {formatTime(timer.initialTime)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={[
                            'inline-block h-2 w-2 rounded-full',
                            isDone ? 'bg-rose-500 animate-pulse' : 'bg-pink-400',
                          ].join(' ')}
                        />
                        <span
                          className={[
                            'text-sm font-medium',
                            isDone ? 'text-rose-500' : 'text-slate-600',
                          ].join(' ')}
                        >
                          {isDone ? '时间到' : '进行中'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 w-full sm:w-auto">
                    <div
                      className={[
                        'text-3xl sm:text-4xl font-semibold tracking-tight tabular-nums',
                        isDone ? 'text-rose-500' : 'text-slate-900',
                      ].join(' ')}
                    >
                      {formatTime(tl)}
                    </div>
                    <button
                      onClick={() => handleRemoveTimer(timer.id, timer.number)}
                      className="h-9 px-4 rounded-lg bg-slate-50 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900 active:scale-[0.98]"
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
        {timers.length === 0 && !isLoading && (
          <div className="mt-10 rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
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
            <p className="text-slate-700 font-medium">暂无计时器</p>
            <p className="mt-1 text-sm text-slate-400">选择一个编号并添加计时器即可开始</p>
          </div>
        )}
      </div>
    </main>
  );
}
