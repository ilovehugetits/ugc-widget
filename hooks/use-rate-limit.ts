import { useState, useEffect } from 'react';

interface RateLimitState {
  count: number;
  resetTime: number;
}

export function useRateLimit(key: string, limit: number) {
  const [canMakeRequest, setCanMakeRequest] = useState(true);

  useEffect(() => {
    const checkRateLimit = () => {
      const now = Date.now();
      const stored = localStorage.getItem(`rateLimit_${key}`);
      
      if (stored) {
        const state: RateLimitState = JSON.parse(stored);
        if (now < state.resetTime) {
          setCanMakeRequest(state.count < limit);
        } else {
          // Reset if time window has passed
          const newState: RateLimitState = {
            count: 0,
            resetTime: now + 3600000 // 1 hour from now
          };
          localStorage.setItem(`rateLimit_${key}`, JSON.stringify(newState));
          setCanMakeRequest(true);
        }
      } else {
        // Initialize rate limit
        const newState: RateLimitState = {
          count: 0,
          resetTime: now + 3600000 // 1 hour from now
        };
        localStorage.setItem(`rateLimit_${key}`, JSON.stringify(newState));
        setCanMakeRequest(true);
      }
    };

    checkRateLimit();
  }, [key, limit]);

  const incrementRequestCount = () => {
    const stored = localStorage.getItem(`rateLimit_${key}`);
    if (stored) {
      const state: RateLimitState = JSON.parse(stored);
      const newState: RateLimitState = {
        count: state.count + 1,
        resetTime: state.resetTime
      };
      localStorage.setItem(`rateLimit_${key}`, JSON.stringify(newState));
      setCanMakeRequest(newState.count < limit);
    }
  };

  return { canMakeRequest, incrementRequestCount };
} 