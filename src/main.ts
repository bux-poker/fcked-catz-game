import { Game } from './game';
import { UI } from './ui';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ui = new UI();
const game = new Game(canvas);

let phase: 'select' | 'playing' | 'over' = 'select';

game.onHud = (lives, score) => {
  if (phase === 'playing') ui.updateHud(lives, score);
};

game.onTrick = (name, points) => ui.showTrick(name, points);

game.onGameOver = (score) => {
  phase = 'over';
  ui.showGameOver(score);
  ui.setPhase('over');
};

ui.bindHandlers({
  onStart: () => {
    if (!ui.selectedCat) return;
    game.setCharacter(ui.selectedCat);
    phase = 'playing';
    ui.setPhase('playing');
    game.start();
  },
  onDismissGameOver: () => {
    phase = 'select';
    game.stop();
    ui.setPhase('select');
  },
});

ui.setPhase('select');

function isLandscape(): boolean {
  const o = screen.orientation?.type;
  if (o) return o.startsWith('landscape');
  return window.innerWidth > window.innerHeight;
}

function updateOrientationLock() {
  document.body.classList.toggle('landscape-locked', isLandscape());
}

updateOrientationLock();
window.addEventListener('resize', updateOrientationLock);
window.addEventListener('orientationchange', updateOrientationLock);
screen.orientation?.addEventListener('change', updateOrientationLock);

function loop() {
  if (!document.body.classList.contains('landscape-locked')) {
    game.tick();
  }
  requestAnimationFrame(loop);
}

loop();
