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
    carSpeed: 7.1,
    carJumpVy: -10.2,
    carGravity: 0.4,
    carFriction: 0.76,
    carMaxVx: 11.6,
    carBoostForce: 2.45,
    carBoostDrain: 0.016,
    carBoostRegen: 0.007,
    boostTrailInterval: 3, // frames between trail spawns
  
    // Ball — tuned for more midfield play / fewer “auto” goals
    ballR: 18,
    ballGravity: 0.32,
    ballElasticity: 0.72,
    ballFriction: 0.986,
    ballGroundFriction: 0.84,
  
    // Goals (slightly shorter mouth = harder to score)
    goalW: 16,
    goalH: 96,
  
    // Kick — weaker shots so defense / positioning matter more
    kickPower: 11.8,
    /** Slightly generous so kicks connect while drifting past the ball */
    kickRange: 84,
    kickCooldownFrames: 22,
    /** Horizontal knockback when a kick hits the other car (Head Soccer–style) */
    kickCarKnockback: 5.8,
  
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
    /** Previous frame jump input (for edge-triggered jumps, player only) */
    lastJumpHeld: boolean;
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
      lastJumpHeld: false,
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
  
  export function tryKick(car: Car, ball: Ball, opponent: Car | null, particles: Particle[]): void {
    if (car.kickCooldown > 0) return;
    const cx = car.x + TURBO.carW / 2;
    const cy = car.y + TURBO.carH / 2;
    let hit = false;

    const dxb = ball.x - cx;
    const dyb = ball.y - cy;
    const distB = Math.sqrt(dxb * dxb + dyb * dyb);
    if (distB <= TURBO.kickRange && distB > 0.01) {
      const nx = dxb / distB;
      const ny = dyb / distB;
      ball.vx += nx * TURBO.kickPower;
      ball.vy += ny * TURBO.kickPower - 1.35;
      spawnParticles(particles, ball.x, ball.y, '#ffffff', 10, 5, false);
      spawnParticles(particles, ball.x, ball.y, car.flipped ? '#00ccff' : '#ff6600', 8, 4, true);
      hit = true;
    }

    if (opponent) {
      const ox = opponent.x + TURBO.carW / 2;
      const oy = opponent.y + TURBO.carH / 2;
      const dxo = ox - cx;
      const dyo = oy - cy;
      const distO = Math.sqrt(dxo * dxo + dyo * dyo);
      const reach = TURBO.kickRange + TURBO.carW * 0.55;
      if (distO <= reach && distO > 0.01) {
        const nx = dxo / distO;
        const ny = dyo / distO;
        opponent.vx += nx * TURBO.kickCarKnockback;
        opponent.vy += ny * TURBO.kickCarKnockback * 0.28 - 0.45;
        spawnParticles(particles, ox, oy, '#ffeedd', 8, 4, true);
        hit = true;
      }
    }

    if (hit) {
      car.kickCooldown = TURBO.kickCooldownFrames;
    }
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
      ball.vx *= 0.86;
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
        const impulse = 1.55;
        const carPush = 0.34;
        ball.vx -= dot * nx * impulse;
        ball.vy -= dot * ny * impulse;
        car.vx += dot * nx * carPush;
        car.vy += dot * ny * carPush;
        spawnParticles(particles, ball.x, ball.y, '#ffffff', 4, 2.5, false);
      }
    }
  }
  
  // ── CPU AI ───────────────────────────────────
  
  export type AiDifficulty = 'easy' | 'medium' | 'hard';
  
  function updateCpuAi(
    cpu: Car,
    humanCar: Car,
    ball: Ball,
    particles: Particle[],
    difficulty: AiDifficulty,
    frameCount: number,
  ): void {
    const reactionMap = { easy: 0.45, medium: 0.7, hard: 0.95 };
    const r = reactionMap[difficulty];
  
    const cpuCx = cpu.x + TURBO.carW / 2;
    const ballDist = Math.abs(cpuCx - ball.x);

    // Ball threatening CPU goal (left): defend harder — faster lateral + more boost
    const threatToCpuGoal =
      ball.x < TURBO.worldW * 0.48 && ball.vx < -1.2 && ball.x > TURBO.goalW + 40;
    const defendMul = threatToCpuGoal ? 1.32 : 1;

    // Target: move toward ball
    const targetX = ball.x - TURBO.carW * 0.5;
    const baseAccel = 0.96 * r * defendMul;
    if (cpuCx < targetX - 8) {
      cpu.vx += baseAccel;
      cpu.flipped = false;
    } else if (cpuCx > targetX + 8) {
      cpu.vx -= baseAccel;
      cpu.flipped = true;
    }

    // Boost: attack when chasing in own half, or defend when ball rockets toward goal
    const attackBoost =
      ball.x > TURBO.worldW * 0.5 &&
      ballDist > TURBO.worldW * 0.18 &&
      difficulty !== 'easy' &&
      cpu.boost > 0.15;
    const defendBoost = threatToCpuGoal && cpu.boost > 0.12 && ballDist > 55;
    const shouldBoost = attackBoost || defendBoost;
  
    cpu.isBoosting = shouldBoost;
    if (shouldBoost) {
      const dir = cpu.flipped ? -1 : 1;
      const bMul = defendBoost ? 1.12 : 1;
      cpu.vx += dir * TURBO.carBoostForce * r * bMul;
      cpu.vy -= 0.28 * r;
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
  
    // Kick — more likely when scrambling defense
    const kickChance = (threatToCpuGoal ? 0.072 : 0.048) * r;
    if (cpu.kickCooldown <= 0 && Math.random() < kickChance) {
      tryKick(cpu, ball, humanCar, particles);
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

    // Match over — keep particles tidy only (avoid physics after buzzer; prevents runaway sim / jank)
    if (state.timeLeftMs <= 0) {
      state.timeLeftMs = 0;
      updateParticles(state.particles);
      return;
    }
  
    // ── Player input ──
    const player = state.player;
    if (!player) return;

    if (inputs.left) {
      player.vx -= TURBO.carSpeed * 0.14;
      player.flipped = true;
    }
    if (inputs.right) {
      player.vx += TURBO.carSpeed * 0.14;
      player.flipped = false;
    }

    // Rising-edge jump: works while steering/boosting; avoids multi-frame jump spam from input pulse
    const jumpEdge = inputs.jump && !player.lastJumpHeld;
    player.lastJumpHeld = inputs.jump;
    if (jumpEdge && player.jumpCount < 2) {
      player.vy = TURBO.carJumpVy;
      player.onGround = false;
      player.jumpCount++;
      spawnParticles(state.particles, player.x + TURBO.carW / 2, player.y + TURBO.carH, '#00ffff', 6, 3, true);
    }

    // Boost: hold BOOST — direction from ◀/▶ if held, otherwise facing (same as movement)
    let boostDir: 0 | -1 | 1 = 0;
    if (inputs.boost && player.boost > 0) {
      if (inputs.left && !inputs.right) boostDir = -1;
      else if (inputs.right && !inputs.left) boostDir = 1;
      else if (inputs.left && inputs.right) boostDir = player.flipped ? -1 : 1;
      else boostDir = player.flipped ? -1 : 1;
    }
    if (boostDir !== 0) {
      player.isBoosting = true;
      player.vx += boostDir * TURBO.carBoostForce;
      player.vy -= 0.3;
      player.boost = Math.max(0, player.boost - TURBO.carBoostDrain);
      if (state.frameCount % TURBO.boostTrailInterval === 0) {
        spawnBoostTrail(state.particles, player);
      }
    } else {
      player.isBoosting = false;
    }

    // Kick while held — tryKick returns fast on cooldown/miss; works with steer + multi-touch
    if (inputs.kick) {
      tryKick(player, state.ball, state.cpu, state.particles);
    }
  
    // ── CPU AI ──
    updateCpuAi(state.cpu, state.player, state.ball, state.particles, difficulty, state.frameCount);
  
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
      state.resetCooldown = 65; // ~1.1s at 60fps — back to play quicker
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