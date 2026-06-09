import { CATS } from './cats';
import type { CatCharacter, GamePhase } from './types';

export class UI {
  selectedCat: CatCharacter | null = null;

  private selectScreen = document.getElementById('screen-select')!;
  private hudScreen = document.getElementById('screen-hud')!;
  private overScreen = document.getElementById('screen-over')!;
  private catGrid = document.getElementById('cat-grid')!;
  private btnStart = document.getElementById('btn-start') as HTMLButtonElement;
  private btnControls = document.getElementById('btn-controls') as HTMLButtonElement;
  private controlsModal = document.getElementById('controls-modal')!;
  private controlsBackdrop = document.getElementById('controls-backdrop') as HTMLButtonElement;
  private btnCloseControls = document.getElementById('btn-close-controls') as HTMLButtonElement;
  private hudLives = document.getElementById('hud-lives')!;
  private hudScore = document.getElementById('hud-score')!;
  private finalScore = document.getElementById('final-score')!;
  private btnMenuOver = document.getElementById('btn-menu-over') as HTMLButtonElement;
  private trickPopup = document.getElementById('trick-popup')!;

  private onStart?: () => void;
  private onDismissGameOver?: () => void;

  constructor() {
    this.buildCatGrid();
    this.btnStart.addEventListener('click', () => {
      if (this.selectedCat && this.onStart) this.onStart();
    });
    this.btnControls.addEventListener('click', () => this.openControls());
    this.btnCloseControls.addEventListener('click', () => this.closeControls());
    this.controlsBackdrop.addEventListener('click', () => this.closeControls());
    this.btnMenuOver.addEventListener('click', () => this.onDismissGameOver?.());
  }

  bindHandlers(handlers: {
    onStart: () => void;
    onDismissGameOver: () => void;
  }) {
    this.onStart = handlers.onStart;
    this.onDismissGameOver = handlers.onDismissGameOver;
  }

  setPhase(phase: GamePhase) {
    this.selectScreen.classList.toggle('hidden', phase !== 'select');
    this.hudScreen.classList.toggle('hidden', phase !== 'playing');
    this.overScreen.classList.toggle('hidden', phase !== 'over');
    if (phase !== 'select') this.closeControls();
  }

  openControls() {
    this.controlsModal.classList.remove('hidden');
  }

  closeControls() {
    this.controlsModal.classList.add('hidden');
  }

  updateHud(lives: number, score: number) {
    this.hudLives.textContent = '❤️'.repeat(lives) + '🖤'.repeat(Math.max(0, 3 - lives));
    this.hudScore.textContent = String(score);
  }

  showGameOver(score: number) {
    this.finalScore.textContent = `Score: ${score}`;
  }

  showTrick(name: string, points: number) {
    this.trickPopup.textContent = `${name} +${points}`;
    this.trickPopup.classList.remove('hidden');
    void this.trickPopup.offsetWidth;
    this.trickPopup.style.animation = 'none';
    void this.trickPopup.offsetWidth;
    this.trickPopup.style.animation = '';
    this.trickPopup.classList.remove('hidden');
    setTimeout(() => this.trickPopup.classList.add('hidden'), 2500);
  }

  private buildCatGrid() {
    for (const cat of CATS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cat-avatar';
      btn.setAttribute('aria-label', cat.name);
      if (cat.portrait) {
        const img = document.createElement('img');
        img.className = 'cat-portrait';
        img.src = cat.portrait;
        img.alt = cat.name;
        btn.appendChild(img);
      } else {
        const swatch = document.createElement('span');
        swatch.className = 'cat-swatch';
        swatch.style.background = cat.color;
        btn.appendChild(swatch);
      }
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cat-avatar').forEach((c) => c.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedCat = cat;
        this.btnStart.disabled = false;
      });
      this.catGrid.appendChild(btn);
    }
  }
}
