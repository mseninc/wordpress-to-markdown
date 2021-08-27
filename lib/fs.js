const { promises: fs } = require('fs');

async function exists(path) {
  try {
    await fs.stat(path);
    return true;
  } catch (error) {
    return false;
  }
}

function ensureDir(dir) {
  return fs.mkdir(dir, { recursive: true });
}

function writeJson(path, obj) {
  return fs.writeFile(path, JSON.stringify(obj, null, '  '));
}

module.exports = {
  exists,
  ensureDir,
  writeJson,
};
