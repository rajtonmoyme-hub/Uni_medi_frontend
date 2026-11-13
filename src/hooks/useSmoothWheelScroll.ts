import { useEffect } from 'react';

/**
 * Provides frame-rate-independent exponential smooth scrolling for discrete
 * mouse-wheel ticks (common on Linux X11/Wayland and Electron) across both the
 * document root scroller and scrollable modal/sidebar containers.
 *
 * High-precision trackpads/touchpads, pinch-zoom, horizontal wheel gestures,
 * native form controls, and prefers-reduced-motion are left 100% native.
 */
export function useSmoothWheelScroll(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const reducedMotionQuery = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    );

    let activeScroller: Element | null = null;
    let currentY = 0;
    let targetY = 0;
    let lastSetY = 0;
    let rafId: number | null = null;
    let lastFrameTime = 0;
    let touchpadBypassUntil = 0;

    const isRootScroller = (el: Element): boolean =>
      el === document.scrollingElement ||
      el === document.documentElement ||
      el === document.body;

    const getScrollTop = (el: Element): number =>
      isRootScroller(el) ? window.scrollY : el.scrollTop;

    const getMaxScrollTop = (el: Element): number =>
      isRootScroller(el)
        ? Math.max(
            0,
            document.documentElement.scrollHeight - window.innerHeight
          )
        : Math.max(0, el.scrollHeight - el.clientHeight);

    const setScrollTopInstant = (el: Element, top: number): void => {
      if (isRootScroller(el)) {
        window.scrollTo({ top, behavior: 'instant' as ScrollBehavior });
      } else {
        el.scrollTo({ top, behavior: 'instant' as ScrollBehavior });
      }
    };

    const stopAnimation = (): void => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      activeScroller = null;
    };

    const findScrollTarget = (
      startNode: EventTarget | null,
      deltaY: number
    ): Element | 'NATIVE_ONLY' | null => {
      const openDialog = document.querySelector('dialog[open]');
      let el = startNode instanceof Element ? startNode : null;

      while (el && el !== document.body && el !== document.documentElement) {
        const tag = el.tagName;
        if (tag === 'TEXTAREA' || tag === 'SELECT') {
          return 'NATIVE_ONLY';
        }

        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        const isScrollableY =
          (overflowY === 'auto' || overflowY === 'scroll') &&
          el.scrollHeight > el.clientHeight + 1;

        if (isScrollableY) {
          const canScrollUp = deltaY < 0 && el.scrollTop > 0.5;
          const canScrollDown =
            deltaY > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 0.5;
          if (canScrollUp || canScrollDown) {
            return el;
          }
          if (
            style.overscrollBehaviorY === 'contain' ||
            style.overscrollBehaviorY === 'none' ||
            openDialog
          ) {
            return null;
          }
        }

        if (el === openDialog) {
          return null;
        }

        el = el.parentElement;
      }

      if (openDialog) {
        return null;
      }

      return document.scrollingElement || document.documentElement;
    };

    const tick = (now: number): void => {
      if (!activeScroller) {
        rafId = null;
        return;
      }

      const actualScrollTop = getScrollTop(activeScroller);
      // Yield immediately if an external scroll (scrollbar drag, keyboard, scrollTo) occurred
      if (Math.abs(actualScrollTop - lastSetY) > 2) {
        stopAnimation();
        return;
      }

      const dt = Math.min(Math.max((now - lastFrameTime) / 1000, 0.001), 0.05);
      lastFrameTime = now;

      const maxScroll = getMaxScrollTop(activeScroller);
      targetY = Math.max(0, Math.min(maxScroll, targetY));

      const diff = targetY - currentY;
      if (Math.abs(diff) < 0.5) {
        currentY = targetY;
        setScrollTopInstant(activeScroller, targetY);
        lastSetY = getScrollTop(activeScroller);
        stopAnimation();
        return;
      }

      // Frame-rate-independent exponential damping (consistent across 60Hz/120Hz/144Hz)
      const alpha = 1 - Math.exp(-18 * dt);
      currentY += diff * alpha;
      setScrollTopInstant(activeScroller, currentY);
      lastSetY = getScrollTop(activeScroller);

      rafId = requestAnimationFrame(tick);
    };

    const handleWheel = (event: WheelEvent): void => {
      if (event.defaultPrevented || reducedMotionQuery.matches) return;
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
        return;
      }

      const now = performance.now();
      const absY = Math.abs(event.deltaY);
      const absX = Math.abs(event.deltaX);

      if (absY === 0) return;

      // HiDPI-safe distinction between precision touchpads and notched mouse wheels:
      // Touchpads emit 2D deltas, small initial pixel steps (< 32px), or non-120 wheelDeltaY quanta.
      const wheelDeltaY = (event as unknown as { wheelDeltaY?: number })
        .wheelDeltaY;
      const isMouseWheelNotch =
        event.deltaMode === 1 ||
        event.deltaMode === 2 ||
        (absX === 0 &&
          typeof wheelDeltaY === 'number' &&
          wheelDeltaY !== 0 &&
          Math.abs(wheelDeltaY) % 120 === 0 &&
          absY >= 32) ||
        (absX === 0 && wheelDeltaY === undefined && absY >= 40);

      if (!isMouseWheelNotch) {
        touchpadBypassUntil = now + 450;
        stopAnimation();
        return;
      }

      if (now < touchpadBypassUntil) {
        touchpadBypassUntil = now + 250;
        return;
      }

      const target = findScrollTarget(event.target, event.deltaY);
      if (target === 'NATIVE_ONLY' || !target) {
        return;
      }

      const maxScroll = getMaxScrollTop(target);
      if (maxScroll <= 0) return;

      const currentPos = getScrollTop(target);
      const atTop = event.deltaY < 0 && currentPos <= 0.5;
      const atBottom = event.deltaY > 0 && currentPos >= maxScroll - 0.5;
      if ((atTop || atBottom) && activeScroller !== target) {
        return;
      }

      let deltaPx = event.deltaY;
      if (event.deltaMode === 1) {
        deltaPx = event.deltaY * 38;
      } else if (event.deltaMode === 2) {
        deltaPx = event.deltaY * window.innerHeight * 0.85;
      }

      event.preventDefault();

      if (activeScroller !== target || rafId === null) {
        activeScroller = target;
        currentY = currentPos;
        targetY = currentPos;
        lastSetY = currentPos;
        lastFrameTime = now;
      }

      targetY = Math.max(0, Math.min(maxScroll, targetY + deltaPx));

      if (rafId === null) {
        rafId = requestAnimationFrame(tick);
      }
    };

    const cancelOnManualInput = (): void => {
      stopAnimation();
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'PageDown' ||
        event.key === 'PageUp' ||
        event.key === 'Home' ||
        event.key === 'End' ||
        event.key === ' '
      ) {
        stopAnimation();
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('mousedown', cancelOnManualInput, { passive: true });
    window.addEventListener('touchstart', cancelOnManualInput, {
      passive: true,
    });
    window.addEventListener('keydown', handleKeyDown, { passive: true });
    window.addEventListener('resize', cancelOnManualInput, { passive: true });

    return () => {
      stopAnimation();
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('mousedown', cancelOnManualInput);
      window.removeEventListener('touchstart', cancelOnManualInput);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', cancelOnManualInput);
    };
  }, []);
}
