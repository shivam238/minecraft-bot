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

// Anti-AFK settings (Natural behavior)
const ANTI_AFK = {
  enabled: true,
  moveInterval: 120000, // Move every 2 minutes
  jumpInterval: 240000, // Jump every 4 minutes
  lookInterval: 60000 // Look around every 1 minute
};

let bot;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let isReconnecting = false;
let afkIntervals = [];

function createBot() {
  // Clear any existing intervals
  afkIntervals.forEach(interval => clearInterval(interval));
  afkIntervals = [];
  
  console.log('[' + new Date().toISOString() + '] Creating bot...');
  
  bot = mineflayer.createBot({
    host: CONFIG.host,
    port: CONFIG.port,
    username: CONFIG.username,
    password: CONFIG.password,
    version: CONFIG.version,
    auth: CONFIG.auth,
    hideErrors: false,
    checkTimeoutInterval: 60000,
    keepAlive: true
  });

  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    console.log('[' + new Date().toISOString() + '] ✓ Bot spawned successfully!');
    reconnectAttempts = 0;
    isReconnecting = false;
    
    try {
      const mcData = require('minecraft-data')(bot.version);
      const movements = new Movements(bot, mcData);
      movements.canDig = false; // Don't break blocks
      movements.allow1by1towers = false; // Don't build
      bot.pathfinder.setMovements(movements);
    } catch (err) {
      console.error('Pathfinder setup error:', err.message);
    }
    
    if (ANTI_AFK.enabled) {
      startAntiAFK();
    }
  });

  bot.on('login', () => {
    console.log('[' + new Date().toISOString() + '] ✓ Bot logged in!');
  });

  bot.on('chat', (username, message) => {
    // Silent mode for stealth
    if (message.toLowerCase().includes('bot') && username !== bot.username) {
      // Optional: respond to direct mentions only
    }
  });

  bot.on('kicked', (reason) => {
    console.log('[' + new Date().toISOString() + '] ✗ Kicked:', reason);
    
    if (reason.includes('another location') || reason.includes('already connected')) {
      console.log('Duplicate login detected. Waiting 30s before retry...');
      isReconnecting = false;
      setTimeout(() => reconnect(), 30000);
      return;
    }
    
    reconnect();
  });

  bot.on('error', (err) => {
    console.error('[' + new Date().toISOString() + '] ✗ Error:', err.message);
    if (!err.message.includes('ECONNREFUSED')) {
      reconnect();
    }
  });

  bot.on('end', (reason) => {
    console.log('[' + new Date().toISOString() + '] ✗ Disconnected:', reason);
    reconnect();
  });

  bot.on('death', () => {
    console.log('[' + new Date().toISOString() + '] ✗ Bot died, respawning...');
    setTimeout(() => {
      try {
        bot.chat('/respawn');
      } catch (err) {
        console.error('Respawn error:', err.message);
      }
    }, 2000);
  });
}

function startAntiAFK() {
  console.log('[' + new Date().toISOString() + '] Starting anti-AFK behavior...');
  
  // Natural movements
  const moveInterval = setInterval(() => {
    if (bot && bot.entity && Math.random() > 0.2) {
      try {
        const x = (Math.random() - 0.5) * 4;
        const z = (Math.random() - 0.5) * 4;
        
        const goal = new goals.GoalNear(
          bot.entity.position.x + x,
          bot.entity.position.y,
          bot.entity.position.z + z,
          1
        );
        
        bot.pathfinder.setGoal(goal, true);
      } catch (err) {
        // Ignore pathfinding errors
      }
    }
  }, ANTI_AFK.moveInterval);
  afkIntervals.push(moveInterval);

  // Occasional jumps
  const jumpInterval = setInterval(() => {
    if (bot && bot.entity && Math.random() > 0.6) {
      try {
        bot.setControlState('jump', true);
        setTimeout(() => bot.setControlState('jump', false), 500);
      } catch (err) {
        // Ignore control errors
      }
    }
  }, ANTI_AFK.jumpInterval);
  afkIntervals.push(jumpInterval);

  // Look around naturally
  const lookInterval = setInterval(() => {
    if (bot && Math.random() > 0.3) {
      try {
        const yaw = Math.random() * Math.PI * 2;
        const pitch = (Math.random() - 0.5) * Math.PI * 0.5;
        bot.look(yaw, pitch);
      } catch (err) {
        // Ignore look errors
      }
    }
  }, ANTI_AFK.lookInterval);
  afkIntervals.push(lookInterval);
}

function reconnect() {
  if (isReconnecting) {
    return;
  }
  
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log('[' + new Date().toISOString() + '] Max reconnect attempts. Resetting counter...');
    reconnectAttempts = 0;
  }
  
  isReconnecting = true;
  reconnectAttempts++;
  
  const delay = Math.min(60000, 10000 * reconnectAttempts);
  console.log('[' + new Date().toISOString() + '] Reconnecting in ' + (delay/1000) + 's (Attempt ' + reconnectAttempts + ')');
  
  setTimeout(() => {
    isReconnecting = false;
    createBot();
  }, delay);
}

// Keep-alive web server for Render
const app = express();

app.get('/', (req, res) => {
  const status = {
    botStatus: bot ? 'Connected' : 'Disconnected',
    uptime: process.uptime(),
    server: CONFIG.host,
    username: CONFIG.username,
    timestamp: new Date().toISOString()
  };
  res.json(status);
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('[' + new Date().toISOString() + '] Keep-alive server running on port ' + PORT);
});

// Error handlers
process.on('uncaughtException', (err) => {
  console.error('[' + new Date().toISOString() + '] Uncaught exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('[' + new Date().toISOString() + '] Unhandled rejection:', err);
});

// Start bot
console.log('[' + new Date().toISOString() + '] Starting Minecraft 24/7 Bot...');
console.log('[' + new Date().toISOString() + '] Server: ' + CONFIG.host + ':' + CONFIG.port);
createBot();
