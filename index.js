const { loadYamlFile, } = require('./lib/yaml');
const {
  ensureDir,
  writeJson,
} = require('./lib/fs');
const {
  transformPost,
  processPost,
} = require('./lib');

const SOURCE_FILE = 'wp_posts.yml';
const TARGET_BASE_DIR = 'result';

async function main() {

  const path = require('path');

  try {

    await ensureDir(TARGET_BASE_DIR);

    const posts = loadYamlFile(SOURCE_FILE);

    const tags = new Set(posts.flatMap(p => p.tagnames.split(',').map(x => x.trim())));
    await writeJson(path.join(TARGET_BASE_DIR, 'tags.json'), [...tags]);
    
    const slugs = new Set(posts.map(p => p.slug));
    await writeJson(path.join(TARGET_BASE_DIR, 'slugs.json'), [...slugs]);

    const records = posts.map(x => transformPost(x, { baseDir: TARGET_BASE_DIR }));

    for (const record of records) {
      await processPost(record);
    }

  } catch (err) {
    console.error(err.message);
  }

}

// Entry point
if (require.main === module) {
  main();
}
