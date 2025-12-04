const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const express = require('express');

// Configuration
const CONFIG = {
  host: 'SHIBU2.aternos.me',
  port: 29527,
  username: 'nokar',
  password: null,
  version: '1.20.1',
  auth: 'offline'
};

// Anti-AFK settings (Stealth mode - more natural behavior)
const ANTI_AFK = {
  enabled: true,
  interval: 90000,
  jumpInterval: 180000,
  lookInterval: 45000
};

let bot;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
let isReconnecting = false;

// Web Dashboard
const app = express();

app.get('/', (req, res) => {
  const status = bot && bot.entity ? 'Online' : 'Connecting...';
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Minecraft Bot</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: Arial; background: #1a1a2e; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .container { text-align: center; background: #16213e; padding: 40px; border-radius: 15px; }
        h1 { color: #4ecca3; }
        .status { font-size: 18px; margin: 20px 0; }
        .online { color: #4ecca3; }
        .offline { color: #e94560; }
        .btn { background: #4ecca3; color: #1a1a2e; border: none; padding: 15px 40px; font-size: 18px; border-radius: 8px; cursor: pointer; margin: 10px; }
        .btn:hover { background: #3db892; }
        .btn-stop { background: #e94560; color: white; }
        .btn-stop:hover { background: #c73e54; }
        .info { margin-top: 20px; color: #888; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Minecraft Bot</h1>
        <p class="status">Status: <strong class="${status === 'Online' ? 'online' : 'offline'}">${status}</strong></p>
        <button class="btn" onclick="location.href='/start'">Start Bot</button>
        <button class="btn btn-stop" onclick="location.href='/stop'">Stop Bot</button>
        <p class="info">Server: ${CONFIG.host}:${CONFIG.port}</p>
        <p class="info">Username: ${CONFIG.username}</p>
      </div>
    </body>
    </html>
  `);
});

app.get('/start', (req, res) => {
  if (!bot || !bot.entity) {
    reconnectAttempts = 0;
    isReconnecting = false;
    createBot();
  }
  res.redirect('/');
});

app.get('/stop', (req, res) => {
  if (bot) {
    bot.quit();
    bot = null;
  }
  res.redirect('/');
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Web dashboard running on port ${PORT}`));

function createBot() {
  console.log('Creating bot...');

  bot = mineflayer.createBot({
    host: CONFIG.host,
    port: CONFIG.port,
    username: CONFIG.username,
    password: CONFIG.password,
    version: CONFIG.version,
    auth: CONFIG.auth,
    hideErrors: false
  });

  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    console.log('✓ Bot spawned successfully!');
    reconnectAttempts = 0;

    const mcData = require('minecraft-data')(bot.version);
    const movements = new Movements(bot, mcData);
    bot.pathfinder.setMovements(movements);

    if (ANTI_AFK.enabled) {
      startAntiAFK();
    }
  });

  bot.on('login', () => {
    console.log('✓ Bot logged in!');
    console.log(`Server: ${CONFIG.host}`);
  });

  bot.on('chat', (username, message) => {
  });

  bot.on('health', () => {
    console.log(`Health: ${bot.health}, Food: ${bot.food}`);

    if (bot.food < 18) {
      const food = bot.inventory.items().find(item => item.name.includes('bread') || 
                                                       item.name.includes('beef') || 
                                                       item.name.includes('chicken') ||
                                                       item.name.includes('mutton') ||
                                                       item.name.includes('pork') ||
                                                       item.name.includes('apple') ||
                                                       item.name.includes('carrot') ||
                                                       item.name.includes('potato'));
      if (food) {
        bot.equip(food, 'hand').then(() => {
          bot.consume();
        });
      }
    }
  });

  bot.on('kicked', (reason) => {
    console.log(`✗ Bot was kicked: ${reason}`);
    if (reason.includes('another location')) {
      console.log('Duplicate login detected. Stopping reconnection to prevent loop.');
      isReconnecting = false;
      return;
    }
    reconnect();
  });

  bot.on('error', (err) => {
    console.error('✗ Bot error:', err.message);
    if (err.message.includes('Invalid credentials')) {
      console.error('Please check your username/password in CONFIG');
    }
  });

  bot.on('end', () => {
    console.log('✗ Bot disconnected');
    reconnect();
  });

  bot.on('death', () => {
    console.log('✗ Bot died, respawning...');
    bot.chat('/respawn');
  });
}

function startAntiAFK() {
  setInterval(() => {
    if (bot && bot.entity) {
      if (Math.random() > 0.3) {
        const x = Math.random() * 3 - 1.5;
        const z = Math.random() * 3 - 1.5;

        const goal = new goals.GoalNear(
          bot.entity.position.x + x,
          bot.entity.position.y,
          bot.entity.position.z + z,
          1
        );

        bot.pathfinder.setGoal(goal, true);
      }
    }
  }, ANTI_AFK.interval);

  setInterval(() => {
    if (bot && bot.entity && Math.random() > 0.5) {
      bot.setControlState('jump', true);
      setTimeout(() => {
        bot.setControlState('jump', false);
      }, 500);
    }
  }, ANTI_AFK.jumpInterval);

  setInterval(() => {
    if (bot && Math.random() > 0.3) {
      const yaw = Math.random() * Math.PI * 2;
      const pitch = (Math.random() - 0.5) * Math.PI * 0.4;
      bot.look(yaw, pitch);
    }
  }, ANTI_AFK.lookInterval);
}

function reconnect() {
  if (isReconnecting) {
    console.log('Reconnection already in progress, skipping...');
    return;
  }

  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    isReconnecting = true;
    reconnectAttempts++;
    const delay = Math.min(30000, 5000 * reconnectAttempts);
    console.log(`Reconnecting in ${delay/1000} seconds... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    setTimeout(() => {
      isReconnecting = false;
      createBot();
    }, delay);
  } else {
    console.error('Max reconnection attempts reached. Please restart the bot manually.');
    isReconnecting = false;
  }
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  reconnect();
});

console.log('Starting Minecraft 24/7 Bot...');
console.log('Press Ctrl+C to stop');
createBot();
