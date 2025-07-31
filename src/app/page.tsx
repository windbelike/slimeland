'use client';

import { useState, useEffect } from 'react';
import { playDingSound } from './sounds';

interface Timer {
  id: number;
  name: string;
  timeLeft: number;
  initialTime: number;
  startTime: number;
}

interface Toast {
  id: number;
  message: string;
}

type SortMode = 'startTime' | 'timeLeft';

const DEFAULT_HOURS = 2;
const DEFAULT_MINUTES = 0;
const STORAGE_KEY = 'countdown-timers';

const SLIME_COLOR = {
  primary: 'rgb(142, 207, 201)',
  secondary: 'rgb(190, 229, 225)',
  background: 'rgb(231, 245, 243)',
  text: 'rgb(73, 116, 112)',
  dark: 'rgb(45, 87, 83)',
};

export default function Home() {
  const [timers, setTimers] = useState<Timer[]>([]);
  const [inputName, setInputName] = useState('');
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('startTime');

  // Load timers from localStorage
  useEffect(() => {
    try {
      const savedTimers = localStorage.getItem(STORAGE_KEY);
      if (savedTimers) {
        setTimers(JSON.parse(savedTimers));
      }
    } catch (error) {
      console.error("Failed to parse timers from localStorage", error);
    }
  }, []);

  // Listen for storage events from other windows
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue !== null) {
        try {
          const newTimers = JSON.parse(event.newValue);
          setTimers(newTimers);
        } catch (error) {
          console.error("Failed to parse timers from storage event", error);
        }
      }
    };

    // Add event listener
    window.addEventListener('storage', handleStorageChange);

    // Cleanup
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Timer countdown logic
  useEffect(() => {
    const hasActiveTimers = timers.some(timer => timer.timeLeft > 0);
    if (!hasActiveTimers) return;

    const interval = setInterval(() => {
      setTimers(prevTimers => {
        const updatedTimers = prevTimers.map(timer => {
          if (timer.timeLeft <= 0) return timer;
          if (timer.timeLeft === 1) {
            playDingSound();
          }
          return { ...timer, timeLeft: timer.timeLeft - 1 };
        });

        // Save to localStorage after each update
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTimers));
        return updatedTimers;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timers]);

  // Save timers to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
  }, [timers]);

  const showToast = (message: string) => {
    const newToast = { id: Date.now(), message };
    setToasts(prev => [...prev, newToast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== newToast.id));
    }, 3000);
  };
  
  const handleAddTimer = () => {
    const trimmedName = inputName.trim().slice(0, 20);
    if (trimmedName === '') return;

    const nameExists = timers.some(timer => timer.name.toLowerCase() === trimmedName.toLowerCase());
    if (nameExists) {
      showToast(`"${trimmedName}" already exists!`);
      return;
    }

    const totalSeconds = (hours * 3600) + (minutes * 60);
    const newTimer: Timer = {
      id: Date.now(),
      name: trimmedName,
      timeLeft: totalSeconds,
      initialTime: totalSeconds > 0 ? totalSeconds : 1,
      startTime: Date.now(),
    };
    setTimers(prevTimers => [...prevTimers, newTimer]);
    setInputName('');
    setHours(DEFAULT_HOURS);
    setMinutes(DEFAULT_MINUTES);
  };

  const handleRemoveTimer = (id: number) => {
    setTimers(prevTimers => prevTimers.filter(timer => timer.id !== id));
  };

  const handleResetTimer = (id: number) => {
    setTimers(prevTimers =>
      prevTimers.map(timer =>
        timer.id === id
          ? { ...timer, timeLeft: timer.initialTime, startTime: Date.now() }
          : timer
      )
    );
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputName(e.target.value);
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
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const getSortedTimers = () => {
    return [...timers].sort((a, b) => {
      if (sortMode === 'startTime') {
        return a.startTime - b.startTime; // Oldest first
      } else {
        return a.timeLeft - b.timeLeft; // Least time remaining first
      }
    });
  };

  const toggleSortMode = () => {
    setSortMode(prev => prev === 'startTime' ? 'timeLeft' : 'startTime');
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 bg-gradient-to-b from-[#E7F5F3] to-[#FFFFFF]">
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-slideIn"
            style={{
              backgroundColor: SLIME_COLOR.primary,
              color: 'white',
            }}
          >
            <div className="w-2 h-2 rounded-full bg-white/50" />
            {toast.message}
          </div>
        ))}
      </div>

      <h1 
        className="text-3xl sm:text-5xl font-[700] mb-6 sm:mb-8 text-center relative"
        style={{ 
          color: SLIME_COLOR.text,
          textShadow: `2px 2px 4px ${SLIME_COLOR.secondary}`,
        }}
      >
        Slime Timer
        <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full"
          style={{ backgroundColor: SLIME_COLOR.secondary }}
        />
      </h1>
      
      <div className="flex flex-col items-center gap-4 mb-6 sm:mb-8 w-full max-w-xl">
        <div className="flex flex-col sm:flex-row gap-4 items-center w-full">
          <input
            type="text"
            placeholder="Enter a name"
            value={inputName}
            onChange={handleInputChange}
            maxLength={20}
            className="px-4 py-2 text-base sm:text-lg font-[400] rounded-full bg-white/70 border-2 focus:outline-none focus:ring-2 transition-all duration-300 w-full sm:w-60 placeholder-[#8EBDB7]"
            style={{ 
              borderColor: SLIME_COLOR.primary,
              color: SLIME_COLOR.text,
            }}
          />
          <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
            <input
              type="number"
              min="0"
              max="23"
              value={hours}
              onChange={(e) => setHours(Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0)))}
              className="px-3 py-2 text-base sm:text-lg font-[400] rounded-full bg-white/70 border-2 focus:outline-none focus:ring-2 transition-all duration-300 w-20 text-center"
              style={{ 
                borderColor: SLIME_COLOR.primary,
                color: SLIME_COLOR.text,
              }}
            />
            <span className="text-base sm:text-lg font-[300]" style={{ color: SLIME_COLOR.text }}>h</span>
            <input
              type="number"
              min="0"
              max="59"
              value={minutes}
              onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
              className="px-3 py-2 text-base sm:text-lg font-[400] rounded-full bg-white/70 border-2 focus:outline-none focus:ring-2 transition-all duration-300 w-20 text-center"
              style={{ 
                borderColor: SLIME_COLOR.primary,
                color: SLIME_COLOR.text,
              }}
            />
            <span className="text-base sm:text-lg font-[300]" style={{ color: SLIME_COLOR.text }}>m</span>
          </div>
        </div>
        <div className="flex gap-2 w-full">
          <button 
            onClick={handleAddTimer}
            className="px-6 py-2 text-base sm:text-lg font-[600] rounded-full transition-all duration-300 flex-1 hover:scale-[1.02] hover:shadow-lg active:scale-95 relative overflow-hidden"
            style={{ 
              backgroundColor: SLIME_COLOR.primary,
              color: 'white',
            }}
          >
            Add Timer
            <div className="absolute top-0 left-0 w-full h-1 bg-white/20 rounded-full" />
          </button>
          <button
            onClick={toggleSortMode}
            className="px-4 py-2 text-sm sm:text-base font-[500] rounded-full transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2"
            style={{ 
              backgroundColor: SLIME_COLOR.secondary,
              color: SLIME_COLOR.text,
            }}
          >
            {sortMode === 'startTime' ? '⏰' : '⏳'}
          </button>
        </div>
      </div>

      <div className="w-full max-w-5xl">
        
        <div className="flex flex-col gap-4">
          {getSortedTimers().map(timer => (
            <div 
              key={timer.id} 
              className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 rounded-2xl shadow-lg gap-4 sm:gap-6 transition-all duration-300 hover:scale-[1.01] relative overflow-hidden"
              style={{ 
                backgroundColor: 'white',
                border: `2px solid ${SLIME_COLOR.secondary}`,
              }}
            >
              <div 
                className="absolute top-0 left-0 h-full transition-all duration-300"
                style={{ 
                  width: `${(timer.timeLeft / (timer.initialTime || 1)) * 100}%`,
                  backgroundColor: SLIME_COLOR.primary,
                  opacity: 0.1,
                }}
              />
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 relative">
                <h2 className="text-xl sm:text-2xl font-[600] capitalize flex items-center gap-2" style={{ color: SLIME_COLOR.text }}>
                  {timer.name}
                  <span className="text-sm font-[400] opacity-60">
                    ({formatTime(timer.initialTime)})
                  </span>
                </h2>
                <div className="flex gap-2 items-center">
                  <div className="w-2 h-2 rounded-full animate-pulse" 
                    style={{ 
                      backgroundColor: timer.timeLeft === 0 ? '#ff6b6b' : SLIME_COLOR.primary 
                    }} 
                  />
                  <p className="text-sm font-[500]" 
                    style={{ 
                      color: timer.timeLeft === 0 ? '#ff6b6b' : SLIME_COLOR.primary,
                      fontWeight: timer.timeLeft === 0 ? '600' : '500'
                    }}
                  >
                    {timer.timeLeft === 0 ? "Time's up! started at " + formatStartTime(timer.startTime) : "Started at " + formatStartTime(timer.startTime)}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 w-full sm:w-auto relative">
                <div className="text-3xl sm:text-4xl font-[500] tracking-wider" style={{ color: SLIME_COLOR.dark }}>
                  {formatTime(timer.timeLeft)}
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleResetTimer(timer.id)}
                    className="px-4 py-2 text-sm sm:text-base font-[500] rounded-full transition-all duration-300 flex-1 sm:flex-initial hover:scale-105 active:scale-95"
                    style={{ 
                      backgroundColor: SLIME_COLOR.secondary,
                      color: SLIME_COLOR.text,
                    }}
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => handleRemoveTimer(timer.id)}
                    className="px-4 py-2 text-sm sm:text-base font-[500] rounded-full transition-all duration-300 flex-1 sm:flex-initial hover:scale-105 active:scale-95 bg-red-100 text-red-500 hover:bg-red-200"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {timers.length === 0 && (
        <div className="text-center mt-8">
          <p className="text-lg font-[300]" style={{ color: SLIME_COLOR.text }}>
            No active timers. Add one to get started!
          </p>
          <div className="mt-4 w-16 h-16 rounded-full mx-auto animate-bounce"
            style={{ backgroundColor: SLIME_COLOR.secondary }}
          />
        </div>
      )}
    </main>
  );
}


