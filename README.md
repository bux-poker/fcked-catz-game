# Fcked Catz — Downhill Skate

Browser-based 3D downhill skate game for the Fcked Catz NFT project.

## Play locally

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

### Test on your phone (same Wi‑Fi)

1. Run `npm run dev`
2. In the terminal, look for the **Network** line, e.g. `http://172.20.10.4:5173/`
3. On your phone's browser, open that exact URL (not `localhost`)
4. Phone and Mac must be on the **same network** (same Wi‑Fi, or phone hotspot with Mac connected to it)

If the page won't load, check **System Settings → Network → Firewall** on your Mac and allow incoming connections for Node, or temporarily disable the firewall to test.

## Controls

| Input | Action |
|-------|--------|
| Drag finger / mouse | Steer left & right |
| Arrow keys / A D | Steer (desktop) |
| Swipe (1 finger, in air) | Basic trick |
| Two-finger swipe L/R | Kickflip |
| Two-finger swipe U/D | Grab |
| Space / Q / E | Tricks (desktop, in air) |

## Game flow

Pick a cat → skate downhill → dodge traffic → hit ramps → do tricks → 3 lives → game over.

Speed increases over time. Score = distance + tricks.

## Edit as you go

| File | What to tweak |
|------|----------------|
| `src/types.ts` | Speed, lives, trick points, road width |
| `src/cats.ts` | Cat roster and NFT portraits |
| `src/game.ts` | Spawning, visuals, game feel |
| `src/style.css` | UI look |

## Build for deploy

```bash
npm run build
npm run preview
```

Output goes to `dist/` — host on Vercel, Netlify, or your domain when you're ready.
