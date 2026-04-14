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

  const showToast = useCallback((message: string) => {
    const newToast = { id: Date.now(), message };
    setToasts(prev => [...prev, newToast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== newToast.id));
    }, 3000);
  }, []);

  // 加载当前日期计时器
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

  // 加载历史记录
  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/timers/history');
      const data = (await res.json()) as { days: string[] };
      setHistoryDays(data.days || []);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  }, []);

  // 首次加载
  useEffect(() => {
    loadTimers(getDayKey());
    loadHistory();
  }, [loadTimers, loadHistory]);

  // 全局 tick：有活跃计时器时每秒刷新 UI
  useEffect(() => {
    const hasActive = timers.some(t => timeLeftOf(t) > 0);
    if (!hasActive) return;

    const interval = setInterval(() => {
      setTick(v => v + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timers]);

  // 轮询：每 8 秒同步一次（多设备同步）
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
        showToast(`✨ 编号 ${newTimer.number} 的计时器添加成功！`);
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
        showToast(`🗑️ 编号 ${number} 已移除`);
      } else {
        showToast('移除失败，请重试');
      }
    } catch (error) {
      console.error('Remove timer error:', error);
      showToast('移除失败，请重试');
    }
  };

  const handleResetTimer = async (id: number, number: string) => {
    try {
      const res = await fetch(`/api/timers?id=${id}&day=${currentDay}`, {
        method: 'PATCH',
      });
      const data = (await res.json()) as { success: boolean; timers: Timer[] };
      if (data.success) {
        setTimers(data.timers);
        showToast(`🔄 编号 ${number} 已重置`);
      } else {
        showToast('重置失败，请重试');
      }
    } catch (error) {
      console.error('Reset timer error:', error);
      showToast('重置失败，请重试');
    }
  };

  const handleSwitchDay = (day: string) => {
    loadTimers(day);
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

  const sortedTimers = (() => {
    return [...timers].sort((a, b) => timeLeftOf(a) - timeLeftOf(b));
  })();

  const progress = (secondsLeft: number, initialTime: number) => {
    if (initialTime === 0) return 0;
    return Math.max(0, Math.min(100, (secondsLeft / initialTime) * 100));
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#FFF0F5] via-[#FFF5F7] to-[#FFFAFB] text-rose-900 px-4 py-6 sm:px-8 sm:py-10">
      {/* 背景装饰 */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-pink-300/20 rounded-full blur-3xl animate-pulse-soft" />
        <div className="absolute top-1/3 right-0 w-96 h-96 bg-rose-300/15 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-pink-200/20 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '2s' }} />
      </div>

      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-3">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="animate-slideIn flex items-center gap-3 rounded-2xl bg-white/95 backdrop-blur-md border border-pink-200 px-4 py-3 shadow-lg shadow-pink-200/30"
          >
            <span className="inline-flex h-2 w-2 rounded-full bg-pink-500" />
            <span className="text-sm font-medium text-rose-800">{toast.message}</span>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-4xl">
        {/* 标题 */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-400 to-rose-400 text-white text-2xl shadow-lg shadow-pink-300/50 mb-4 animate-float">
            🎀
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">
            萌萌计时器
          </h1>
          <p className="mt-2 text-rose-400 text-sm sm:text-base font-medium">
            选择可爱编号，记录每一天的美好时光 ✨
          </p>
        </div>

        {/* 日期切换 */}
        <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 rounded-2xl border border-pink-200 bg-white/70 backdrop-blur-sm px-5 py-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-rose-600">
                {formatDayLabel(currentDay)}
              </span>
              <span className="text-xs text-rose-400">
                每天凌晨 6 点开启新的一天
              </span>
            </div>
          </div>
          {historyDays.length > 0 && (
            <select
              value={currentDay}
              onChange={e => handleSwitchDay(e.target.value)}
              className="h-12 px-4 rounded-2xl border border-pink-200 bg-white/70 text-rose-700 text-sm font-medium shadow-sm outline-none focus:border-pink-400"
            >
              <option value={getDayKey()}>今天</option>
              {historyDays.map(day => (
                <option key={day} value={day}>
                  {formatDayLabel(day)}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 编号选择器 */}
        <div className="mb-6 rounded-3xl border border-pink-200 bg-white/60 backdrop-blur-sm p-5 sm:p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-bold text-rose-600">选择编号</span>
            {selectedNumber && (
              <span className="text-xs font-bold text-pink-500 bg-pink-100 px-3 py-1 rounded-full">
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
                    'relative h-12 sm:h-14 rounded-2xl text-sm sm:text-base font-bold transition-all duration-200',
                    isSelected
                      ? 'bg-gradient-to-br from-pink-400 to-rose-400 text-white shadow-lg shadow-pink-300/50 scale-105'
                      : isActive
                      ? 'bg-pink-100/60 text-pink-300 cursor-not-allowed'
                      : 'bg-white text-rose-500 hover:bg-pink-50 hover:text-pink-600 border border-pink-200 shadow-sm',
                  ].join(' ')}
                >
                  {num}
                  {isActive && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-pink-300" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 时间输入 & 添加 */}
        <div className="mb-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="flex items-center justify-center gap-3 rounded-3xl border border-pink-200 bg-white/60 backdrop-blur-sm px-5 py-4 shadow-sm">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={23}
                value={hours}
                onChange={e => setHours(Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0)))}
                className="h-12 w-20 rounded-2xl bg-pink-50 text-center text-2xl font-bold text-rose-700 outline-none ring-0 border border-pink-200 focus:border-pink-400 transition-colors"
              />
              <span className="text-rose-400 text-sm font-bold">时</span>
            </div>
            <span className="text-pink-300 text-xl">:</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={e => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                className="h-12 w-20 rounded-2xl bg-pink-50 text-center text-2xl font-bold text-rose-700 outline-none ring-0 border border-pink-200 focus:border-pink-400 transition-colors"
              />
              <span className="text-rose-400 text-sm font-bold">分</span>
            </div>
          </div>

          <button
            onClick={handleAddTimer}
            disabled={isLoading}
            className="w-full h-16 sm:h-[58px] rounded-3xl bg-gradient-to-r from-pink-400 to-rose-400 text-white font-bold text-lg transition-all duration-200 hover:shadow-lg hover:shadow-pink-300/50 active:scale-[0.98] disabled:opacity-60"
          >
            {isLoading ? '加载中...' : '✨ 添加计时器'}
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
                className="group relative overflow-hidden rounded-3xl border border-pink-200 bg-white/70 backdrop-blur-sm transition-all duration-300 hover:border-pink-300 hover:bg-white shadow-sm"
              >
                {/* 进度条 */}
                <div
                  className="absolute bottom-0 left-0 h-2 rounded-full transition-all duration-1000"
                  style={{
                    width: `${pct}%`,
                    background: isDone
                      ? 'linear-gradient(90deg, #f43f5e, #fb7185)'
                      : 'linear-gradient(90deg, #f472b6, #fb7185)',
                  }}
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-100 to-rose-100 border border-pink-200 text-lg font-bold text-rose-600">
                      {timer.number}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wider text-rose-400 font-bold">
                          {formatStartTime(timer.startTime)} 开始
                        </span>
                        <span className="text-xs text-pink-300">•</span>
                        <span className="text-xs text-rose-400">
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
                            'text-sm font-bold',
                            isDone ? 'text-rose-500' : 'text-pink-500',
                          ].join(' ')}
                        >
                          {isDone ? '时间到啦 🎉' : '进行中 ~'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 w-full sm:w-auto">
                    <div
                      className={[
                        'text-3xl sm:text-4xl font-bold tracking-tight tabular-nums',
                        isDone ? 'text-rose-500' : 'text-rose-700',
                      ].join(' ')}
                    >
                      {formatTime(tl)}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleResetTimer(timer.id, timer.number)}
                        className="h-9 px-3 rounded-xl border border-pink-200 bg-pink-50 text-xs font-bold text-pink-500 transition-all duration-200 hover:bg-pink-100 hover:text-pink-600 active:scale-[0.98]"
                      >
                        重置
                      </button>
                      <button
                        onClick={() => handleRemoveTimer(timer.id, timer.number)}
                        className="h-9 px-3 rounded-xl bg-rose-50 text-xs font-bold text-rose-500 transition-all duration-200 hover:bg-rose-100 active:scale-[0.98]"
                      >
                        移除
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 空状态 */}
        {timers.length === 0 && !isLoading && (
          <div className="mt-10 rounded-3xl border border-dashed border-pink-300 bg-white/60 p-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-100 border border-pink-200 text-2xl animate-float">
              🐰
            </div>
            <p className="text-rose-600 font-bold">暂无计时器</p>
            <p className="mt-1 text-sm text-rose-400">选一个编号，添加今天的第一个计时器吧 ~</p>
          </div>
        )}
      </div>
    </main>
  );
}
