const { SnakeSystem } = require('./script.js');

describe('SnakeSystem.applyPowerup', () => {
  let snakeSystem;

  beforeEach(() => {
    snakeSystem = new SnakeSystem();
  });

  test('should increase speed for "speed" powerup', () => {
    const initialSpeed = snakeSystem.speed;
    snakeSystem.applyPowerup('speed');
    expect(snakeSystem.speed).toBe(initialSpeed + 34);
  });

  test('should cap speed at 270 for "speed" powerup', () => {
    snakeSystem.speed = 260;
    snakeSystem.applyPowerup('speed');
    expect(snakeSystem.speed).toBe(270);
  });

  test('should decrease speed for "slowmo" powerup', () => {
    const initialSpeed = snakeSystem.speed;
    snakeSystem.applyPowerup('slowmo');
    expect(snakeSystem.speed).toBe(initialSpeed - 30);
  });

  test('should floor speed at 95 for "slowmo" powerup', () => {
    snakeSystem.speed = 100;
    snakeSystem.applyPowerup('slowmo');
    expect(snakeSystem.speed).toBe(95);
  });

  test('should set invincible to 4 for "invincible" powerup', () => {
    snakeSystem.applyPowerup('invincible');
    expect(snakeSystem.invincible).toBe(4);
  });

  test('should not change state for unknown powerup type', () => {
    const initialSpeed = snakeSystem.speed;
    const initialInvincible = snakeSystem.invincible;
    snakeSystem.applyPowerup('unknown');
    expect(snakeSystem.speed).toBe(initialSpeed);
    expect(snakeSystem.invincible).toBe(initialInvincible);
  });
});
