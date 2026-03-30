// ─────────────────────────────────────────────
//  TurboArenaEngine.ts  –  pure game logic, no React
// ─────────────────────────────────────────────

export const TURBO = {
    // World dimensions (logical units)
    worldW: 600,
    worldH: 320,
  
    // Car
    carW: 52,
    carH: 26,
    carSpeed: 4.8,
    carJumpVy: -9.5,
    carGravity: 0.38,
    carFriction: 0.82,
    carMaxVx: 7.5,
    carBoostForce: 1.6,
    carBoostDrain: 0.018,
    carBoostRegen: 0.004,
    boostTrailInterval: 3, // frames between trail spawns
  
    // Ball
    ballR: 18,
    ballGravity: 0.28,
    ballElasticity: 0.72,
    ballFriction: 0.985,
    ballGroundFriction: 0.87,
  
    // Goals
    goalW: 16,
    goalH: 110,
  
    // Kick
    kickPower: 13,
    kickRange: 70,
    kickCooldownFrames: 28,
  
    // Match
    matchMs: 120_000,
  
    // Ground Y (bottom of playfield)
    get groundY() {
      return TURBO.worldH - 28;
    },
    get goalY() {
      return TURBO.groundY - TURBO.goalH;
    },
  };
  
  export interface Car {
    x: number;
    y: number;
    vx: number;
    vy: number;
    onGround: boolean;
    jumpCount: number;
    boost: number; // 0–1
    kickCooldown: number;
    flipped: boolean; // facing left?
    isBoosting: boolean;
    trail: { x: number; y: number; age: number }[];
  }
  
  export interface Ball {
    x: number;
    y: number;
    vx: number;
    vy: number;
    spin: number;
    trail: { x: number; y: number }[];
  }
  
  export interface GoalFlash {
    scorer: 1 | 2;
    ms: number;
  }
  
  export interface TurboArenaState {
    player: Car;
    cpu: Car;
    ball: Ball;
    scoreP1: number;
    scoreP2: number;
    timeLeftMs: number;
    goalFlash: GoalFlash | null;
    resetCooldown: number; // frames
    particles: Particle[];
    frameCount: number;
  }
  
  export interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number; // 0–1
    decay: number;
    r: number;
    color: string;
    glow: boolean;
  }
  
  // ── Helpers ──────────────────────────────────
  
  function clamp(v: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, v));
  }
  
  function makeCar(x: number, flipped: boolean): Car {
    return {
      x,
      y: TURBO.groundY - TURBO.carH,
      vx: 0,
      vy: 0,
      onGround: true,
      jumpCount: 0,
      boost: 1,
      kickCooldown: 0,
      flipped,
      isBoosting: false,
      trail: [],
    };
  }
  
  function makeBall(): Ball {
    return {
      x: TURBO.worldW / 2,
      y: TURBO.groundY - TURBO.ballR * 3,
      vx: (Math.random() - 0.5) * 3,
      vy: -2,
      spin: 0,
      trail: [],
    };
  }
  
  export function createTurboArenaState(): TurboArenaState {
    return {
      player: makeCar(TURBO.worldW * 0.18, false),
      cpu: makeCar(TURBO.worldW * 0.82 - TURBO.carW, true),
      ball: makeBall(),
      scoreP1: 0,
      scoreP2: 0,
      timeLeftMs: TURBO.matchMs,
      goalFlash: null,
      resetCooldown: 0,
      particles: [],
      frameCount: 0,
    };
  }
  
  // ── Kick ─────────────────────────────────────
  
  export function tryKick(car: Car, ball: Ball, particles: Particle[]): void {
    if (car.kickCooldown > 0) return;
    const cx = car.x + TURBO.carW / 2;
    const cy = car.y + TURBO.carH / 2;
    const dx = ball.x - cx;
    const dy = ball.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > TURBO.kickRange || dist < 0.01) return;
    car.kickCooldown = TURBO.kickCooldownFrames;
    const nx = dx / dist;
    const ny = dy / dist;
    ball.vx += nx * TURBO.kickPower;
    ball.vy += ny * TURBO.kickPower - 2;
    spawnParticles(particles, ball.x, ball.y, '#ffffff', 10, 5, false);
    spawnParticles(particles, ball.x, ball.y, car.flipped ? '#00ccff' : '#ff6600', 8, 4, true);
  }
  
  // ── Particles ────────────────────────────────
  
  export function spawnParticles(
    particles: Particle[],
    x: number,
    y: number,
    color: string,
    count: number,
    speed: number,
    glow: boolean,
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (Math.random() * 0.5 + 0.5) * speed;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 1,
        life: 1,
        decay: 0.03 + Math.random() * 0.04,
        r: Math.random() * 3 + 1,
        color,
        glow,
      });
    }
  }
  
  function spawnBoostTrail(particles: Particle[], car: Car): void {
    const cx = car.flipped ? car.x + TURBO.carW : car.x;
    const cy = car.y + TURBO.carH * 0.65;
    particles.push({
      x: cx + (Math.random() - 0.5) * 4,
      y: cy + (Math.random() - 0.5) * 4,
      vx: (car.flipped ? 2.5 : -2.5) + (Math.random() - 0.5),
      vy: (Math.random() - 0.5) * 0.8,
      life: 1,
      decay: 0.1 + Math.random() * 0.06,
      r: Math.random() * 4 + 2,
      color: car.flipped ? '#00aaff' : '#ff6600',
      glow: true,
    });
  }
  
  // ── Car physics ──────────────────────────────
  
  function integrateCar(car: Car, dtMs: number): void {
    const dt = dtMs / 16.67;
    car.vx = clamp(car.vx, -TURBO.carMaxVx, TURBO.carMaxVx);
    car.vx *= Math.pow(TURBO.carFriction, dt);
    car.vy += TURBO.carGravity * dt;
    car.x += car.vx * dt;
    car.y += car.vy * dt;
  
    // Ground
    if (car.y + TURBO.carH >= TURBO.groundY) {
      car.y = TURBO.groundY - TURBO.carH;
      car.vy = 0;
      car.onGround = true;
      car.jumpCount = 0;
    } else {
      car.onGround = false;
    }
  
    // Wall bounds (leave goal gap)
    const leftBound = TURBO.goalW;
    const rightBound = TURBO.worldW - TURBO.goalW - TURBO.carW;
    car.x = clamp(car.x, leftBound, rightBound);
  
    // Ceiling
    if (car.y < 0) {
      car.y = 0;
      car.vy = Math.abs(car.vy) * 0.5;
    }
  
    // Boost regen
    if (!car.isBoosting) {
      car.boost = Math.min(1, car.boost + TURBO.carBoostRegen);
    }
  
    // Kick cooldown
    if (car.kickCooldown > 0) car.kickCooldown--;
  
    // Trail
    car.trail.push({ x: car.x + TURBO.carW / 2, y: car.y + TURBO.carH / 2, age: 0 });
    car.trail = car.trail
      .map((p) => ({ ...p, age: p.age + 1 }))
      .filter((p) => p.age < 10);
  }
  
  // ── Ball physics ─────────────────────────────
  
  function integrateBall(ball: Ball, dtMs: number, particles: Particle[]): void {
    const dt = dtMs / 16.67;
    ball.vx *= Math.pow(ball.vy === 0 ? TURBO.ballGroundFriction : TURBO.ballFriction, dt);
    ball.vy += TURBO.ballGravity * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.spin += ball.vx * 0.04;
  
    // Ground bounce
    if (ball.y + TURBO.ballR >= TURBO.groundY) {
      ball.y = TURBO.groundY - TURBO.ballR;
      ball.vy = -Math.abs(ball.vy) * TURBO.ballElasticity;
      ball.vx *= 0.85;
      if (Math.abs(ball.vy) < 0.5) ball.vy = 0;
    }
  
    // Ceiling
    if (ball.y - TURBO.ballR <= 0) {
      ball.y = TURBO.ballR;
      ball.vy = Math.abs(ball.vy) * TURBO.ballElasticity;
    }
  
    // Ball trail
    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 14) ball.trail.shift();
  }
  
  // ── Car vs Ball collision ─────────────────────
  
  function carBallCollision(car: Car, ball: Ball, particles: Particle[]): void {
    const cx = car.x + TURBO.carW / 2;
    const cy = car.y + TURBO.carH / 2;
    const dx = ball.x - cx;
    const dy = ball.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = TURBO.ballR + Math.min(TURBO.carW, TURBO.carH) * 0.52;
    if (dist < minDist && dist > 0.01) {
      const nx = dx / dist;
      const ny = dy / dist;
      ball.x = cx + nx * minDist;
      ball.y = cy + ny * minDist;
      const relVx = ball.vx - car.vx;
      const relVy = ball.vy - car.vy;
      const dot = relVx * nx + relVy * ny;
      if (dot < 0) {
        ball.vx -= dot * nx * 1.5;
        ball.vy -= dot * ny * 1.5;
        car.vx += dot * nx * 0.25;
        car.vy += dot * ny * 0.25;
        spawnParticles(particles, ball.x, ball.y, '#ffffff', 4, 2.5, false);
      }
    }
  }
  
  // ── CPU AI ───────────────────────────────────
  
  export type AiDifficulty = 'easy' | 'medium' | 'hard';
  
  function updateCpuAi(
    cpu: Car,
    ball: Ball,
    particles: Particle[],
    difficulty: AiDifficulty,
    frameCount: number,
  ): void {
    const reactionMap = { easy: 0.45, medium: 0.7, hard: 0.95 };
    const r = reactionMap[difficulty];
  
    const cpuCx = cpu.x + TURBO.carW / 2;
    const ballDist = Math.abs(cpuCx - ball.x);
  
    // Target: move toward ball
    const targetX = ball.x - TURBO.carW * 0.5;
    if (cpuCx < targetX - 8) {
      cpu.vx += 0.65 * r;
      cpu.flipped = false;
    } else if (cpuCx > targetX + 8) {
      cpu.vx -= 0.65 * r;
      cpu.flipped = true;
    }
  
    // Boost: engage when far and ball is in CPU's half
    const shouldBoost =
      ball.x > TURBO.worldW * 0.5 &&
      ballDist > TURBO.worldW * 0.18 &&
      difficulty !== 'easy' &&
      cpu.boost > 0.15;
  
    cpu.isBoosting = shouldBoost;
    if (shouldBoost) {
      const dir = cpu.flipped ? -1 : 1;
      cpu.vx += dir * TURBO.carBoostForce * r;
      cpu.vy -= 0.25 * r;
      cpu.boost = Math.max(0, cpu.boost - TURBO.carBoostDrain);
      if (frameCount % TURBO.boostTrailInterval === 0) {
        spawnBoostTrail(particles, cpu);
      }
    }
  
    // Jump: if ball is above and close
    if (
      ball.y < TURBO.groundY - TURBO.ballR * 3 &&
      ballDist < TURBO.worldW * 0.22 &&
      cpu.jumpCount < 2
    ) {
      const shouldJump = cpu.onGround
        ? Math.random() < 0.04 * r * 10
        : cpu.jumpCount === 1 && ball.y < TURBO.groundY * 0.45 && Math.random() < 0.015 * r * 10;
  
      if (shouldJump) {
        cpu.vy = TURBO.carJumpVy;
        cpu.onGround = false;
        cpu.jumpCount++;
      }
    }
  
    // Kick
    if (cpu.kickCooldown <= 0 && Math.random() < 0.04 * r) {
      tryKick(cpu, ball, particles);
    }
  }
  
  // ── Goal detection ────────────────────────────
  
  function checkGoal(state: TurboArenaState): 1 | 2 | null {
    const { ball } = state;
  
    // Ball enters left goal → P2 scores
    if (
      ball.x - TURBO.ballR <= TURBO.goalW &&
      ball.y + TURBO.ballR >= TURBO.goalY
    ) {
      return 2;
    }
  
    // Ball enters right goal → P1 scores
    if (
      ball.x + TURBO.ballR >= TURBO.worldW - TURBO.goalW &&
      ball.y + TURBO.ballR >= TURBO.goalY
    ) {
      return 1;
    }
  
    return null;
  }
  
  function resetPositions(state: TurboArenaState): void {
    state.player = makeCar(TURBO.worldW * 0.18, false);
    state.cpu = makeCar(TURBO.worldW * 0.82 - TURBO.carW, true);
    state.ball = makeBall();
  }
  
  // ── Wall bounce for ball ──────────────────────
  
  function ballWallBounce(ball: Ball): void {
    // Left wall (outside goal zone)
    if (ball.x - TURBO.ballR <= TURBO.goalW) {
      if (ball.y + TURBO.ballR < TURBO.goalY) {
        ball.x = TURBO.goalW + TURBO.ballR;
        ball.vx = Math.abs(ball.vx) * TURBO.ballElasticity;
      }
    }
  
    // Right wall
    if (ball.x + TURBO.ballR >= TURBO.worldW - TURBO.goalW) {
      if (ball.y + TURBO.ballR < TURBO.goalY) {
        ball.x = TURBO.worldW - TURBO.goalW - TURBO.ballR;
        ball.vx = -Math.abs(ball.vx) * TURBO.ballElasticity;
      }
    }
  }
  
  // ── Main step ─────────────────────────────────
  
  export interface TurboInputs {
    left: boolean;
    right: boolean;
    jump: boolean; // leading-edge only
    boost: boolean;
    kick: boolean;
  }
  
  export function stepTurboArena(
    state: TurboArenaState,
    dtMs: number,
    inputs: TurboInputs,
    difficulty: AiDifficulty,
  ): void {
    state.frameCount++;
    const dt = dtMs / 16.67;
  
    // Pause during goal reset
    if (state.resetCooldown > 0) {
      state.resetCooldown--;
      if (state.resetCooldown === 0) {
        resetPositions(state);
        state.goalFlash = null;
      }
      // Still update particles
      updateParticles(state.particles);
      return;
    }
  
    // Timer
    state.timeLeftMs = Math.max(0, state.timeLeftMs - dtMs);
  
    // ── Player input ──
    const { player } = state;
  
    if (inputs.left) {
      player.vx -= TURBO.carSpeed * 0.14;
      player.flipped = true;
    }
    if (inputs.right) {
      player.vx += TURBO.carSpeed * 0.14;
      player.flipped = false;
    }
    if (inputs.jump && player.jumpCount < 2) {
      player.vy = TURBO.carJumpVy;
      player.onGround = false;
      player.jumpCount++;
      spawnParticles(state.particles, player.x + TURBO.carW / 2, player.y + TURBO.carH, '#00ffff', 6, 3, true);
    }
    if (inputs.boost && player.boost > 0) {
      player.isBoosting = true;
      const dir = player.flipped ? -1 : 1;
      player.vx += dir * TURBO.carBoostForce;
      player.vy -= 0.3;
      player.boost = Math.max(0, player.boost - TURBO.carBoostDrain);
      if (state.frameCount % TURBO.boostTrailInterval === 0) {
        spawnBoostTrail(state.particles, player);
      }
    } else {
      player.isBoosting = false;
    }
    if (inputs.kick) {
      tryKick(player, state.ball, state.particles);
    }
  
    // ── CPU AI ──
    updateCpuAi(state.cpu, state.ball, state.particles, difficulty, state.frameCount);
  
    // ── Integrate ──
    integrateCar(state.player, dtMs);
    integrateCar(state.cpu, dtMs);
    integrateBall(state.ball, dtMs, state.particles);
  
    // ── Collisions ──
    carBallCollision(state.player, state.ball, state.particles);
    carBallCollision(state.cpu, state.ball, state.particles);
    ballWallBounce(state.ball);
  
    // ── Goals ──
    const scorer = checkGoal(state);
    if (scorer !== null) {
      if (scorer === 1) state.scoreP1++;
      else state.scoreP2++;
      state.goalFlash = { scorer, ms: 2200 };
      state.resetCooldown = 120; // ~2s at 60fps
      spawnParticles(state.particles, TURBO.worldW / 2, TURBO.worldH / 2, '#ffff00', 30, 8, true);
      spawnParticles(
        state.particles,
        TURBO.worldW / 2,
        TURBO.worldH / 2,
        scorer === 1 ? '#ff6600' : '#00ccff',
        20,
        6,
        true,
      );
    }
  
    // ── Particles ──
    updateParticles(state.particles);
  }
  
  function updateParticles(particles: Particle[]): void {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.vx *= 0.95;
      p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }