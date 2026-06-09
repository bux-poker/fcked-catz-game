import type { AirTrickType } from './types';

const MIN_SWIPE = 70;
const MIN_DIAG = 38;

export type InputAction =
  | { type: 'ollie' }
  | { type: 'airTrick'; trick: AirTrickType };

export class InputManager {
  steer = 0;
  airborne = false;
  private steerId: number | null = null;
  private lastX = 0;
  private touchStarts = new Map<number, { x: number; y: number }>();
  private actionListeners: Array<(a: InputAction) => void> = [];

  constructor(private el: HTMLElement) {
    el.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    el.addEventListener('pointermove', (e) => this.onPointerMove(e));
    el.addEventListener('pointerup', (e) => this.onPointerUp(e));
    el.addEventListener('pointercancel', (e) => this.onPointerUp(e));

    el.addEventListener(
      'touchstart',
      (e) => {
        for (const t of Array.from(e.changedTouches)) {
          this.touchStarts.set(t.identifier, { x: t.clientX, y: t.clientY });
        }
      },
      { passive: true },
    );

    el.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: true });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') this.steer = -1;
      if (e.key === 'ArrowRight' || e.key === 'd') this.steer = 1;
      if (e.key === ' ') this.emitAction({ type: 'ollie' });
      if (e.key === 'q') this.emitAction({ type: 'airTrick', trick: 'kickflip' });
      if (e.key === 'e') this.emitAction({ type: 'airTrick', trick: 'heelflip' });
      if (e.key === 'z') this.emitAction({ type: 'airTrick', trick: 'tailgrab' });
      if (e.key === 'c') this.emitAction({ type: 'airTrick', trick: 'nosegrab' });
    });
    window.addEventListener('keyup', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) this.steer = 0;
    });
  }

  setAirborne(v: boolean) {
    this.airborne = v;
  }

  onAction(cb: (a: InputAction) => void) {
    this.actionListeners.push(cb);
  }

  resetSteer() {
    this.steer = 0;
    this.steerId = null;
  }

  private emitAction(a: InputAction) {
    for (const cb of this.actionListeners) cb(a);
  }

  private onPointerDown(e: PointerEvent) {
    if (e.pointerType === 'touch') return;
    if (this.steerId === null) {
      this.steerId = e.pointerId;
      this.lastX = e.clientX;
      this.el.setPointerCapture(e.pointerId);
    }
  }

  private onPointerMove(e: PointerEvent) {
    if (e.pointerId !== this.steerId) return;
    const dx = e.clientX - this.lastX;
    this.lastX = e.clientX;
    this.steer = Math.max(-1, Math.min(1, -dx * 0.045));
  }

  private onPointerUp(e: PointerEvent) {
    if (e.pointerId === this.steerId) {
      this.steerId = null;
      this.steer = 0;
      try {
        this.el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  }

  private onTouchEnd(e: TouchEvent) {
    const touches = Array.from(e.touches);
    const ended = Array.from(e.changedTouches);

    if (ended.length === 1 && touches.length === 0) {
      const t = ended[0];
      const start = this.touchStarts.get(t.identifier);
      if (start) {
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= MIN_SWIPE) {
          const action = this.classifySwipe(dx, dy);
          if (action) this.emitAction(action);
        }
      }
    }

    for (const t of ended) this.touchStarts.delete(t.identifier);
  }

  private classifySwipe(dx: number, dy: number): InputAction | null {
    if (!this.airborne) {
      if (dy > 0 && Math.abs(dy) > Math.abs(dx)) return { type: 'ollie' };
      return null;
    }

    if (Math.abs(dx) < MIN_DIAG || Math.abs(dy) < MIN_DIAG) return null;

    if (dx < 0 && dy > 0) return { type: 'airTrick', trick: 'kickflip' };
    if (dx > 0 && dy > 0) return { type: 'airTrick', trick: 'heelflip' };
    if (dx < 0 && dy < 0) return { type: 'airTrick', trick: 'tailgrab' };
    if (dx > 0 && dy < 0) return { type: 'airTrick', trick: 'nosegrab' };
    return null;
  }
}

export class TouchSteering {
  steer = 0;

  constructor(el: HTMLElement) {
    let activeId: number | null = null;
    let lastX = 0;

    el.addEventListener(
      'touchstart',
      (e) => {
        if (activeId !== null) return;
        const t = e.changedTouches[0];
        activeId = t.identifier;
        lastX = t.clientX;
      },
      { passive: true },
    );

    el.addEventListener(
      'touchmove',
      (e) => {
        if (activeId === null) return;
        for (const t of Array.from(e.touches)) {
          if (t.identifier !== activeId) continue;
          const dx = t.clientX - lastX;
          lastX = t.clientX;
          this.steer = Math.max(-1, Math.min(1, -dx * 0.05));
        }
      },
      { passive: true },
    );

    const end = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === activeId) {
          activeId = null;
          this.steer = 0;
        }
      }
    };
    el.addEventListener('touchend', end, { passive: true });
    el.addEventListener('touchcancel', end, { passive: true });
  }
}
