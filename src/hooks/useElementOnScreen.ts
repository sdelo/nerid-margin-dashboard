import { useEffect, useRef, useState } from 'react';

interface UseElementOnScreenOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

export function useElementOnScreen(options: UseElementOnScreenOptions = {}) {
  const { threshold = 0.1, rootMargin = '0px', triggerOnce = true } = options;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (triggerOnce && containerRef.current) {
            observer.unobserve(containerRef.current);
          }
        } else if (!triggerOnce) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, [threshold, rootMargin, triggerOnce]);

  return [containerRef, isVisible] as const;
}








