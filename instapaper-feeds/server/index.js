const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');
const Parser = require('rss-parser');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const DATA_DIR = fs.existsSync('/data') ? '/data' : __dirname;
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const LOGS_FILE = path.join(DATA_DIR, 'last_run_logs.txt');
const TOML_CONFIG_DIR = process.env.HOME ? path.join(process.env.HOME, '.config', 'feeds-to-instapaper') : path.join(__dirname, '.config', 'feeds-to-instapaper');
const TOML_CONFIG_FILE = path.join(TOML_CONFIG_DIR, 'config.toml');

let schedulerInterval = null;

const defaultConfig = {
  instapaper: { username: '', password: '' },
  feeds: [],
  frequency: 60 // minutes
};

// Initialize config
if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
}

function getConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (e) {
    return defaultConfig;
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  generateToml(config);
  restartScheduler(config);
}

function generateToml(config) {
  if (!fs.existsSync(TOML_CONFIG_DIR)) {
    fs.mkdirSync(TOML_CONFIG_DIR, { recursive: true });
  }
  
  const urls = config.feeds.map(url => `    "${url}"`).join(',\n');
  const tomlContent = `[instapaper]
username = "${config.instapaper.username}"
password = "${config.instapaper.password}"

[feeds]
urls = [
${urls}
]
`;
  fs.writeFileSync(TOML_CONFIG_FILE, tomlContent);
}

function runFeedsToInstapaper() {
  const logStream = fs.createWriteStream(LOGS_FILE, { flags: 'w' });
  const timeStr = new Date().toISOString();
  logStream.write(`[${timeStr}] Starting feeds-to-instapaper...\n`);
  
  // Actually run the binary
  const child = spawn('feeds-to-instapaper', [], {
    env: { ...process.env, STATE_DIR: DATA_DIR } // Try to keep state in data dir if the app respects it, or it defaults to current dir
  });

  child.stdout.on('data', (data) => logStream.write(data));
  child.stderr.on('data', (data) => logStream.write(data));

  child.on('close', (code) => {
    logStream.write(`[${new Date().toISOString()}] Process exited with code ${code}\n`);
    logStream.end();
  });
  
  // For local testing if the binary isn't installed
  child.on('error', (err) => {
    logStream.write(`[${new Date().toISOString()}] Failed to start feeds-to-instapaper: ${err.message}\n`);
    logStream.end();
  });
}

function restartScheduler(config) {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }
  
  if (config.instapaper.username && config.instapaper.password && config.feeds.length > 0) {
    // Run immediately on config change
    runFeedsToInstapaper();
    
    const freqMs = (config.frequency || 60) * 60 * 1000;
    schedulerInterval = setInterval(() => {
      runFeedsToInstapaper();
    }, freqMs);
  }
}

// Routes
app.get('/api/config', (req, res) => {
  res.json(getConfig());
});

app.post('/api/config', (req, res) => {
  const newConfig = { ...getConfig(), ...req.body };
  saveConfig(newConfig);
  res.json({ success: true });
});

app.post('/api/validate-instapaper', async (req, res) => {
  const { username, password } = req.body;
  try {
    // Instapaper simple auth endpoint
    const response = await axios.post('https://www.instapaper.com/api/authenticate', 
      new URLSearchParams({ username, password }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );
    if (response.status === 200) {
      res.json({ success: true });
    } else {
      res.json({ success: false, error: 'Authentication failed' });
    }
  } catch (error) {
    res.json({ success: false, error: 'Authentication failed' });
  }
});

app.post('/api/validate-rss', async (req, res) => {
  const { url } = req.body;
  const parser = new Parser();
  try {
    const feed = await parser.parseURL(url);
    res.json({ success: true, title: feed.title || 'Valid RSS Feed' });
  } catch (error) {
    res.json({ success: false, error: 'Invalid or unreachable RSS feed' });
  }
});

app.get('/api/logs', (req, res) => {
  if (fs.existsSync(LOGS_FILE)) {
    res.send(fs.readFileSync(LOGS_FILE, 'utf8'));
  } else {
    res.send('No logs available yet.');
  }
});

// Run once on startup
const initialConfig = getConfig();
generateToml(initialConfig);
restartScheduler(initialConfig);

const PORT = process.env.INGRESS_PORT || 8099;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
