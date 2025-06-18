'use client';
import { useState, useEffect } from 'react';

interface CountdownTimerProps {
  endDate: Date | string;
}

export function CountdownTimer({ endDate }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false
  });

  useEffect(() => {
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
    const calculateTimeLeft = () => {
      const difference = end.getTime() - new Date().getTime();
      if (difference <= 0) {
        return {
          hours: 0,
          minutes: 0,
          seconds: 0,
          isExpired: true
        };
      }
      return {
        hours: Math.floor(difference / (1000 * 60 * 60)),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        isExpired: false
      };
    };
    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, [endDate]);

  if (timeLeft.isExpired) {
    return (
      <div className="text-red-600 text-sm font-medium">
        Sale Ended
      </div>
    );
  }

  return (
    <div className="text-sm text-gray-600">
      <span className="font-medium">Sale ends in: </span>
      <span className="font-semibold">
        {String(timeLeft.hours).padStart(2, '0')}:
        {String(timeLeft.minutes).padStart(2, '0')}:
        {String(timeLeft.seconds).padStart(2, '0')}
      </span>
    </div>
  );
} 