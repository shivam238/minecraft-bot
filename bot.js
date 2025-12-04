const mineflayer = require('mineflayer');
const { pathfinder, GoalNear } = require('mineflayer-pathfinder');

function createBot() {
  const bot = mineflayer.createBot({
    host: process.env.SERVER_IP,
    port: parseInt(process.env.SERVER_PORT || '25565'),
    username: process.env.MINECRAFT_USERNAME,
    version: '1.20.1' // Fabric version
  });

  bot.loadPlugin(pathfinder);

  bot.on('spawn', () => {
    console.log('Bot online!');
  });

  // Auto reconnect on disconnect
  bot.on('end', () => {
    console.log('Bot disconnected. Reconnecting in 5s...');
    setTimeout(createBot, 5000);
  });

  bot.on('error', (err) => {
    console.log('Error:', err.message);
  });

  // Public commands, everyone can control
  bot.on('chat', (username, message) => {
    if (!message.startsWith('!bot')) return;
    const args = message.split(' ');
    const cmd = args[1];

    if (cmd === 'hello') bot.chat(`Hello ${username}!`);
    if (cmd === 'come') {
      const target = bot.players[username]?.entity;
      if (target) bot.pathfinder.setGoal(new GoalNear(target.position.x, target.position.y, target.position.z, 1));
    }
  });
}

createBot();
