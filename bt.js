  const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    let W, H, scale;
    let gameState = 'menu'; // menu, playing, paused, over
    let score = 0;
    let bestScore = parseInt(localStorage.getItem('bt_best') || '0');
    let blocks = [];
    let currentBlock = null;
    let groundY;
    let cameraY = 0;
    let targetCameraY = 0;
    let swingSpeed, swingDir;
    let blockWidth, blockHeight;
    let particles = [];
    let perfectStreak = 0;
    let lastFrameTime = 0;
    let gameOverTimer = 0;
    let fallingBlocks = [];
    let flashAlpha = 0;

    const BLOCK_COLORS = [
      '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
      '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6', '#6366f1'
    ];

    function resize() {
      W = canvas.parentElement.clientWidth;
      H = canvas.parentElement.clientHeight;
      canvas.width = W;
      canvas.height = H;
      scale = Math.min(W / 400, H / 700);
      groundY = H - 60 * scale;
      blockWidth = 90 * scale;
      blockHeight = 32 * scale;
    }

    function getBlockColor(i) {
      return BLOCK_COLORS[i % BLOCK_COLORS.length];
    }

    function initGame() {
      blocks = [];
      fallingBlocks = [];
      particles = [];
      score = 0;
      perfectStreak = 0;
      cameraY = 0;
      targetCameraY = 0;
      swingSpeed = 2.2 * scale;
      swingDir = 1;
      flashAlpha = 0;
      gameOverTimer = 0;

      const foundationW = blockWidth + 20 * scale;
      blocks.push({
        x: W / 2 - foundationW / 2,
        y: groundY - blockHeight,
        w: foundationW,
        h: blockHeight,
        color: '#475569',
        settled: true
      });

      spawnBlock();
      updateHUD();
      document.getElementById('startScreen').classList.remove('active');
      document.getElementById('pauseScreen').classList.remove('active');
      document.getElementById('gameOverScreen').classList.remove('active');
      document.getElementById('hud').style.display = 'flex';
      document.getElementById('tapHint').style.display = 'block';
      setTimeout(() => { document.getElementById('tapHint').style.display = 'none'; }, 3000);
      gameState = 'playing';
    }

    function spawnBlock() {
      const topBlock = blocks[blocks.length - 1];
      const w = topBlock.w;
      currentBlock = {
        x: -w,
        y: topBlock.y - blockHeight - 10 * scale,
        w: w,
        h: blockHeight,
        color: getBlockColor(blocks.length),
        vx: swingSpeed * swingDir,
        settled: false
      };
    }

    function dropBlock() {
      if (!currentBlock || gameState !== 'playing') return;

      const top = blocks[blocks.length - 1];
      const cb = currentBlock;
      const overlapLeft = Math.max(cb.x, top.x);
      const overlapRight = Math.min(cb.x + cb.w, top.x + top.w);
      const overlapW = overlapRight - overlapLeft;

      if (overlapW <= 2) {
        fallingBlocks.push({ ...cb, vy: 0, vx: cb.vx * 0.5, rot: 0, vrot: (Math.random() - 0.5) * 0.1 });
        triggerGameOver();
        return;
      }

      const diff = Math.abs(cb.x - top.x);
      const isPerfect = diff < 4 * scale;

      if (isPerfect) {
        perfectStreak++;
        cb.x = top.x;
        cb.w = top.w;
        flashAlpha = 0.3;
        for (let i = 0; i < 12; i++) {
          particles.push({
            x: cb.x + cb.w / 2,
            y: cb.y + cb.h / 2,
            vx: (Math.random() - 0.5) * 6 * scale,
            vy: -Math.random() * 5 * scale,
            life: 1,
            color: '#fbbf24',
            size: (3 + Math.random() * 3) * scale
          });
        }
      } else {
        perfectStreak = 0;
        const cutSide = cb.x < top.x ? 'left' : 'right';
        let trimmedX;
        const cutW = cb.w - overlapW;

        if (cutSide === 'left') {
          fallingBlocks.push({ x: cb.x, y: cb.y, w: cutW, h: cb.h, color: cb.color, vy: 0, vx: -2 * scale, rot: 0, vrot: -0.05 });
          trimmedX = overlapLeft;
        } else {
          fallingBlocks.push({ x: overlapRight, y: cb.y, w: cutW, h: cb.h, color: cb.color, vy: 0, vx: 2 * scale, rot: 0, vrot: 0.05 });
          trimmedX = overlapLeft;
        }

        cb.x = trimmedX;
        cb.w = overlapW;

        for (let i = 0; i < 6; i++) {
          particles.push({
            x: cutSide === 'left' ? cb.x : cb.x + cb.w,
            y: cb.y + cb.h / 2,
            vx: (cutSide === 'left' ? -1 : 1) * Math.random() * 3 * scale,
            vy: -Math.random() * 3 * scale,
            life: 1,
            color: cb.color,
            size: (2 + Math.random() * 2) * scale
          });
        }

        if (overlapW < 8 * scale) {
          fallingBlocks.push({ ...cb, vy: 0, vx: 0, rot: 0, vrot: (Math.random() - 0.5) * 0.05 });
          triggerGameOver();
          return;
        }
      }

      cb.settled = true;
      blocks.push(cb);
      score = blocks.length - 1;
      updateHUD();

      swingSpeed = Math.min((2.2 + score * 0.12) * scale, 7 * scale);
      swingDir *= -1;

      const towerTop = cb.y;
      if (towerTop < H * 0.4) {
        targetCameraY = H * 0.4 - towerTop;
      }

      spawnBlock();
    }

    function triggerGameOver() {
      gameState = 'over';
      currentBlock = null;
      gameOverTimer = 60;
      document.getElementById('gameContainer').classList.add('shake');
      setTimeout(() => document.getElementById('gameContainer').classList.remove('shake'), 400);
    }

    function showGameOverScreen() {
      const isNewBest = score > bestScore;
      if (isNewBest) {
        bestScore = score;
        localStorage.setItem('bt_best', bestScore);
      }
      document.getElementById('finalScore').textContent = score;
      document.getElementById('newBestBadge').style.display = isNewBest ? 'block' : 'none';
      document.getElementById('bestScoreLine').style.display = isNewBest ? 'none' : 'block';
      document.getElementById('overBest').textContent = bestScore;
      document.getElementById('hud').style.display = 'none';
      document.getElementById('gameOverScreen').classList.add('active');
      updateBestDisplays();
    }

    function updateHUD() {
      document.getElementById('scoreDisplay').textContent = score;
      document.getElementById('bestDisplay').textContent = bestScore;
    }

    function updateBestDisplays() {
      document.getElementById('bestDisplay').textContent = bestScore;
      document.getElementById('startBest').textContent = bestScore;
    }

    function togglePause() {
      if (gameState === 'playing') {
        gameState = 'paused';
        document.getElementById('pauseScreen').classList.add('active');
      } else if (gameState === 'paused') {
        gameState = 'playing';
        document.getElementById('pauseScreen').classList.remove('active');
      }
    }

    function drawBlock(b, offsetY) {
      const y = b.y + offsetY;
      const radius = 6 * scale;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      roundRect(ctx, b.x + 2 * scale, y + 2 * scale, b.w, b.h, radius);
      ctx.fill();
      ctx.fillStyle = b.color;
      roundRect(ctx, b.x, y, b.w, b.h, radius);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      roundRect(ctx, b.x, y, b.w, b.h * 0.45, radius);
      ctx.fill();
    }

    function drawFallingBlock(b, offsetY) {
      ctx.save();
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2 + offsetY;
      ctx.translate(cx, cy);
      ctx.rotate(b.rot);
      ctx.globalAlpha = Math.max(0, 1 - Math.abs(b.y - groundY) / (H * 2));
      ctx.fillStyle = b.color;
      roundRect(ctx, -b.w / 2, -b.h / 2, b.w, b.h, 4 * scale);
      ctx.fill();
      ctx.restore();
    }

    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    function drawGround(offsetY) {
      const gy = groundY + offsetY;
      const grad = ctx.createLinearGradient(0, gy, 0, gy + 40 * scale);
      grad.addColorStop(0, '#334155');
      grad.addColorStop(1, '#1e293b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, gy, W, H);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(W, gy);
      ctx.stroke();
    }

    function drawStars() {
      const starSeed = 42;
      let rng = starSeed;
      function pseudoRandom() { rng = (rng * 16807 + 0) % 2147483647; return rng / 2147483647; }
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      for (let i = 0; i < 50; i++) {
        const sx = pseudoRandom() * W;
        const sy = pseudoRandom() * H * 3 - cameraY * 0.2;
        const ss = pseudoRandom() * 1.5 + 0.5;
        if (sy > -10 && sy < H + 10) {
          ctx.beginPath();
          ctx.arc(sx, sy, ss * scale, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    function drawPerfectText() {
      if (perfectStreak >= 2 && gameState === 'playing') {
        ctx.save();
        const top = blocks[blocks.length - 1];
        const ty = top.y + cameraY - 20 * scale;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fbbf24';
        ctx.font = `bold ${18 * scale}px Fredoka, sans-serif`;
        ctx.globalAlpha = Math.min(1, flashAlpha * 5);
        const label = perfectStreak >= 5 ? '🔥 AMAZING!' : perfectStreak >= 3 ? '✨ PERFECT!' : '👌 NICE!';
        ctx.fillText(label, W / 2, ty);
        ctx.restore();
      }
    }

    function update(dt) {
      cameraY += (targetCameraY - cameraY) * 0.08;
      if (flashAlpha > 0) flashAlpha -= 0.01;

      if (gameState === 'playing' && currentBlock) {
        currentBlock.x += currentBlock.vx;
        if (currentBlock.x + currentBlock.w > W) {
          currentBlock.x = W - currentBlock.w;
          currentBlock.vx *= -1;
        }
        if (currentBlock.x < 0) {
          currentBlock.x = 0;
          currentBlock.vx *= -1;
        }
      }

      if (gameState === 'over' && gameOverTimer > 0) {
        gameOverTimer--;
        if (gameOverTimer === 0) showGameOverScreen();
      }

      for (let i = fallingBlocks.length - 1; i >= 0; i--) {
        const fb = fallingBlocks[i];
        fb.vy += 0.4 * scale;
        fb.x += fb.vx;
        fb.y += fb.vy;
        fb.rot += fb.vrot;
        if (fb.y > groundY + H) fallingBlocks.splice(i, 1);
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15 * scale;
        p.life -= 0.025;
        if (p.life <= 0) particles.splice(i, 1);
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#0f172a');
      bgGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      drawStars();
      const offsetY = cameraY;
      drawGround(offsetY);

      for (const b of blocks) {
        drawBlock(b, offsetY);
      }

      if (currentBlock && gameState === 'playing') {
        drawBlock(currentBlock, offsetY);
        ctx.setLineDash([4 * scale, 4 * scale]);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(currentBlock.x + currentBlock.w / 2, currentBlock.y + currentBlock.h + offsetY);
        ctx.lineTo(currentBlock.x + currentBlock.w / 2, groundY + offsetY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      for (const fb of fallingBlocks) {
        drawFallingBlock(fb, offsetY);
      }

      for (const p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y + offsetY, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (flashAlpha > 0) {
        ctx.fillStyle = `rgba(251,191,36,${flashAlpha})`;
        ctx.fillRect(0, 0, W, H);
      }

      drawPerfectText();

      if (gameState === 'playing' && score > 0) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.font = `bold ${80 * scale}px Fredoka, sans-serif`;
        ctx.fillText(score, W / 2, H / 2 + 20 * scale);
        ctx.restore();
      }
    }

    function gameLoop(timestamp) {
      const dt = Math.min((timestamp - lastFrameTime) / 16.67, 3);
      lastFrameTime = timestamp;
      update(dt);
      draw();
      requestAnimationFrame(gameLoop);
    }

    function handleTap() {
      if (gameState === 'playing') {
        dropBlock();
      }
    }

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      handleTap();
    });

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (gameState === 'playing') handleTap();
        else if (gameState === 'menu') initGame();
      }
      if (e.code === 'Escape' && (gameState === 'playing' || gameState === 'paused')) {
        togglePause();
      }
    });

    document.getElementById('playBtn').addEventListener('click', () => initGame());
    document.getElementById('retryBtn').addEventListener('click', () => initGame());
    document.getElementById('pauseBtn').addEventListener('click', () => togglePause());
    document.getElementById('resumeBtn').addEventListener('click', () => togglePause());
    document.getElementById('quitBtn').addEventListener('click', () => {
      gameState = 'menu';
      document.getElementById('pauseScreen').classList.remove('active');
      document.getElementById('startScreen').classList.add('active');
      document.getElementById('hud').style.display = 'none';
    });

    resize();
    updateBestDisplays();
    window.addEventListener('resize', () => {
      resize();
    });
    requestAnimationFrame(gameLoop);