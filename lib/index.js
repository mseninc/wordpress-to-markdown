const { translateName } = require('./name-translation');
const { DateTime } = require('luxon');
const fetch = require('node-fetch');
const sanitize = require("sanitize-filename");
const path = require('path');
const { promises: fs } = require('fs');
const { decode: unescape } = require('html-entities');
const {
  exists,
  ensureDir,
} = require('./fs');

const POST_IMAGE_DIR = 'images';
const DRAFT_DIR = '.draft';
const INDEX_FILE_NAME = 'index.md';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function restoreJetpackCodeBlocks(content) {
  function replacer(match, p1, p2, offset, string) {
    const block = unescape(p2);
    const result = ['```', p1, '\n', block, '```'].join('');
    return result;
  }
  return content?.replace(/^```([^`\n]+)?\n([^`]+)```/mg, replacer)
}

const regexpImg1 = RegExp('<img [^>]*?src="([^"]+)"', 'g');
const regexpImg2 = RegExp('!\\[[^\\]]*\\]\\((.+)\\)', 'g');

function transformPost({
  author_name: oldName,
  date,
  title,
  slug,
  post_content_filtered,
  post_status,
  imageUrl,
  tagnames,
}, { baseDir }) {
  const github = translateName(oldName);
  const datetime = DateTime.fromSQL(date);
  const { year } = datetime;
  const isDraft = post_status !== 'publish' || !slug;
  const dirName = sanitize(isDraft && !slug ? title : slug);
  const dirPath = path.join(
    baseDir || '',
    (isDraft ? DRAFT_DIR : ''),
    github,
    `${year}`,
    dirName
    );
  const tags = tagnames?.split(',').map(x => x.trim());
  const body = restoreJetpackCodeBlocks(post_content_filtered);
  const matches1 = body?.matchAll(regexpImg1) ?? [];
  const matches2 = body?.matchAll(regexpImg2) ?? [];
  const imageSet = new Set([
    ...[...matches1].map(x => x[1]),
    ...[...matches2].map(x => x[1]),
    imageUrl
  ]);
  const images = [...imageSet].filter(x => x); // filter undefined
  return {
    github,
    date: datetime.toFormat('yyyy-MM-dd'),
    title,
    dirPath,
    isDraft,
    tags,
    slug,
    body,
    images,
    eyecatch: imageUrl,
  };
}

async function processPost({ github, date, title, dirPath, tags, slug, body, images, eyecatch }) {

  process.stdout.write(`${dirPath} : `);
  try {
    await ensureDir(dirPath);
  } catch (error) {
    console.error(`error on mkdir`, dirPath, error);
  }
  const filePath = path.join(dirPath, INDEX_FILE_NAME);

  const file = await fs.open(filePath, 'w');
  try {
    
    await file.writeFile(`---
title: ${title || 'No Title'}
date: ${date}
author: ${github}
`);
    if (tags?.length > 0) {
      await file.writeFile(`tags: [${tags.join(', ')}]\n`);
    }
    if (eyecatch) {
      await file.writeFile(`hero: ${eyecatch}\n`);
    }
    await file.writeFile(`---\n\n`);
    await file.writeFile(body);
    await file.close();

  } catch (error) {
    console.error(`error on write`, filePath, error);
  } finally {
    file?.close();
  }
  console.log('done');

  const imageDirPath = path.join(dirPath, POST_IMAGE_DIR);
  await processImages(images, imageDirPath, slug);

  console.log('-'.repeat(100));
}

async function processImages(imageUrls, imageDirPath, slug) {

  if (imageUrls.length === 0) { return; }

  try {
    await ensureDir(imageDirPath);
  } catch (error) {
    console.error(`error on mkdir (images)`, dirPath);
    throw error;
  }

  const imageData = imageUrls.map((url, i) => {
    const remoteFilename = url.match(/([^\/]+)$/) ? RegExp.$1 : null;
    const ext = remoteFilename.match(/([^\.]+)$/) ? `.${RegExp.$1}` : null;
    const expectedUrl = url.match(/^(.+)-\d+x\d+\.[^\.]+$/) ? `${RegExp.$1}${ext}` : null;
    const filename = slug
      ? `${slug}-${i + 1}${ext}`
      : remoteFilename;
    if (!filename) { return null; }
    const imagePath = path.join(imageDirPath, filename);
    return {
      url: expectedUrl || url,
      fallbackUrl: url,
      filename,
      path: imagePath,
    }
  }).filter(x => x); // ignore null

  for (const im of imageData) {
    try {
      process.stdout.write(`  ${im.url} : `);
      if (await exists(im.path)) {
        console.log('exists');
        continue;
      }
      try {
        await downloadImage(im.url, im.path);
        console.log('done');
      } catch (error) {
        await downloadImage(im.fallbackUrl, im.path);
        console.log('done (fallback)');
      }
    } catch (error) {
      console.error(`error`, error.message);
    }
  }

}

async function downloadImage(url, outputPath) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  await fs.writeFile(outputPath, Buffer.from(buffer));
  await sleep(500);
}

module.exports = {
  transformPost,
  processPost,
}
