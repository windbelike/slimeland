'use client';

import { useState, useEffect } from 'react';

interface Timer {
  id: number;
  name: string;
  timeLeft: number;
  initialTime: number;
}

const DEFAULT_HOURS = 2;
const DEFAULT_MINUTES = 0;
const STORAGE_KEY = 'countdown-timers';

export default function Home() {
  const [timers, setTimers] = useState<Timer[]>([]);
  const [inputName, setInputName] = useState('');
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);

  // 从 localStorage 加载数据
  useEffect(() => {
    const savedTimers = localStorage.getItem(STORAGE_KEY);
    if (savedTimers) {
      setTimers(JSON.parse(savedTimers));
    }
  }, []);

  // 保存数据到 localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
  }, [timers]);

  // 计时器逻辑
  useEffect(() => {
    if (timers.some(timer => timer.timeLeft > 0)) {
      const interval = setInterval(() => {
        setTimers(prevTimers => {
          const updatedTimers = prevTimers.map(timer => {
            if (timer.timeLeft > 0) {
              return { ...timer, timeLeft: timer.timeLeft - 1 };
            }
            return timer;
          });
          // 更新 localStorage
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTimers));
          return updatedTimers;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [timers]);

  const handleAddTimer = () => {
    if (inputName.trim() !== '') {
      const totalSeconds = (hours * 3600) + (minutes * 60);
      const newTimer: Timer = {
        id: Date.now(),
        name: inputName.trim().slice(0, 20),
        timeLeft: totalSeconds,
        initialTime: totalSeconds,
      };
      setTimers(prevTimers => [...prevTimers, newTimer]);
      setInputName('');
      setHours(DEFAULT_HOURS);
      setMinutes(DEFAULT_MINUTES);
    }
  };

  const handleRemoveTimer = (id: number) => {
    setTimers(prevTimers => prevTimers.filter(timer => timer.id !== id));
  };

  const handleResetTimer = (id: number) => {
    setTimers(prevTimers =>
      prevTimers.map(timer =>
        timer.id === id
          ? { ...timer, timeLeft: timer.initialTime }
          : timer
      )
    );
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputName(value.slice(0, 20));
  };

  const handleClearAll = () => {
    if (timers.length > 0) {
      setTimers([]);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return [
      String(hours).padStart(2, '0'),
      String(minutes).padStart(2, '0'),
      String(secs).padStart(2, '0'),
    ].join(':');
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 bg-gray-900 text-white">
      <h1 className="text-3xl sm:text-5xl font-[700] mb-6 sm:mb-8 text-center" style={{ color: 'rgb(135, 154, 57)' }}>
        Multi-Countdown Timer
      </h1>
      
      <div className="flex flex-col items-center gap-4 mb-6 sm:mb-8 w-full max-w-xl">
        <div className="flex flex-col sm:flex-row gap-4 items-center w-full">
          <input
            type="text"
            placeholder="Enter a name"
            value={inputName}
            onChange={handleInputChange}
            maxLength={20}
            className="px-4 py-2 text-base sm:text-lg font-[400] rounded-md bg-gray-800 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[rgb(135,154,57)] w-full sm:w-60"
          />
          <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
            <input
              type="number"
              min="0"
              max="23"
              value={hours}
              onChange={(e) => setHours(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
              className="px-3 py-2 text-base sm:text-lg font-[400] rounded-md bg-gray-800 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[rgb(135,154,57)] w-20"
            />
            <span className="text-base sm:text-lg font-[300]">h</span>
            <input
              type="number"
              min="0"
              max="59"
              value={minutes}
              onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
              className="px-3 py-2 text-base sm:text-lg font-[400] rounded-md bg-gray-800 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[rgb(135,154,57)] w-20"
            />
            <span className="text-base sm:text-lg font-[300]">m</span>
          </div>
        </div>
        <div className="flex gap-2 w-full">
          <button 
            onClick={handleAddTimer}
            className="px-6 py-2 text-base sm:text-lg font-[600] rounded-md transition-colors flex-1 hover:brightness-90"
            style={{ 
              backgroundColor: 'rgb(135, 154, 57)'
            }}
          >
            Add Timer
          </button>
          {/* {timers.length > 0 && (
            <button 
              onClick={handleClearAll}
              className="px-4 py-2 text-base sm:text-lg font-[600] rounded-md transition-colors hover:bg-red-700 bg-red-600"
            >
              Clear All
            </button>
          )} */}
        </div>
      </div>

      <div className="w-full max-w-5xl flex flex-col gap-4">
        {timers.map(timer => (
          <div key={timer.id} className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between bg-gray-800 p-4 rounded-lg shadow-lg gap-4 sm:gap-6">
            <h2 className="text-xl sm:text-2xl font-[600] capitalize" style={{ color: 'rgb(135, 154, 57)' }}>{timer.name}</h2>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 w-full sm:w-auto">
              <div className="text-3xl sm:text-4xl font-[500] tracking-wider">
                {formatTime(timer.timeLeft)}
              </div>
              {timer.timeLeft === 0 && (
                <p className="text-base sm:text-lg font-[500] whitespace-nowrap" style={{ color: 'rgb(135, 154, 57)' }}>
                  Time's up!
                </p>
              )}
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => handleResetTimer(timer.id)}
                  className="px-4 py-2 text-sm sm:text-base font-[500] rounded-md transition-colors flex-1 sm:flex-initial"
                  style={{ 
                    backgroundColor: 'rgba(135, 154, 57, 0.2)',
                    color: 'rgb(135, 154, 57)',
                    border: '1px solid rgb(135, 154, 57)'
                  }}
                >
                  Reset
                </button>
                <button
                  onClick={() => handleRemoveTimer(timer.id)}
                  className="px-4 py-2 text-sm sm:text-base font-[500] rounded-md bg-red-600 hover:bg-red-700 transition-colors flex-1 sm:flex-initial"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {timers.length === 0 && (
        <p className="text-gray-400 font-[300] text-center">No active timers. Add one to get started!</p>
      )}
    </main>
  );
}

