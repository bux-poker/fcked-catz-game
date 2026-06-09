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

function loop() {
  game.tick();
  requestAnimationFrame(loop);
}

loop();
