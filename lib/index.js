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
const INTERNAL_URL_PATTERN = 'https?://mseeeen.msen.jp/[\\w/:%#\\$&\\?~\\.=\\+\\-]+';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const regexpImg1 = RegExp('<img [^>]*?src="([^"]+)"', 'g');
const regexpImg2 = RegExp('!\\[[^\\]]*\\]\\((.+)\\)', 'g');
const regexpInternalLinks = RegExp(INTERNAL_URL_PATTERN, 'g');

function restoreJetpackCodeBlocks(content) {
  function replacer(match, p1, p2, offset, string) {
    const block = unescape(p2);
    const result = ['```', p1, '\n', block, '```'].join('');
    return result;
  }
  return content?.replace(/^```([^`\n]+)?\n([^`]+)```/mg, replacer)
}

function restoreEscapedLinks(content) {
  return content.replace(/^&lt;.+$/mg, m => unescape(m));
}

function replaceLineFeeds(content) {
  return content.replace('\r\n', '\n');
}

function replaceImageUrls(content, images) {
  if (!content || !images || images.length === 0) { return content; }
  let result = content;
  for (const { url, fallbackUrl, filename } of images) {
    const fileRelPath = `${POST_IMAGE_DIR}/${filename}`;
    result = result.split(url).join(fileRelPath);
    if (url !== fallbackUrl) {
      result = result.split(fallbackUrl).join(fileRelPath);
    }
  }
  return result;
}

function getImageDataFromUrl(imageUrl, imageDirPath, slug, index) {
  const remoteFilename = imageUrl.match(/([^\/]+)$/) ? RegExp.$1 : null;
  const ext = remoteFilename.match(/([^\.]+)$/) ? `.${RegExp.$1}` : null;
  const expectedUrl = imageUrl.match(/^(.+)-\d+x\d+\.[^\.]+$/) ? `${RegExp.$1}${ext}` : null;
  const id = index > 0 ? `-${index}` : '';
  const filename = slug
    ? `${slug}${id}${ext}`
    : remoteFilename;
  if (!filename) { throw Error(`failed to extract filename from "${imageUrl}"`) }
  const imagePath = path.join(imageDirPath, filename);
  return {
    url: expectedUrl || imageUrl,
    fallbackUrl: imageUrl,
    filename,
    imagePath,
  }
}

function escapeTitle(title) {
  const removed = title.replace(/"/g, '');
  const quoted = removed.match(/[\[\]:]/) ? `"${removed}"` : removed;
  return quoted;
}

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
  const tmpBody = restoreEscapedLinks(restoreJetpackCodeBlocks(replaceLineFeeds(post_content_filtered)));
  const tags = tagnames?.split(',').map(x => x.trim());
  const imageDirPath = path.join(dirPath, POST_IMAGE_DIR);
  const matches1 = tmpBody?.matchAll(regexpImg1) ?? [];
  const matches2 = tmpBody?.matchAll(regexpImg2) ?? [];
  const imageSet = new Set([
    ...[...matches1].map(x => x[1]),
    ...[...matches2].map(x => x[1]),
  ]);
  const images = [...imageSet]
    .filter(x => x) // filter undefined
    .map((url, i) => getImageDataFromUrl(url, imageDirPath, slug, i + 1))
    .filter(x => x); // ignore null
  const eyecatch = imageUrl ? getImageDataFromUrl(imageUrl, imageDirPath, slug) : null;
  const imageReplaced = replaceImageUrls(tmpBody, images);
  const body = imageReplaced?.split('http://mseeeen').join('https://mseeeen');
  const links = [...body?.matchAll(regexpInternalLinks)].map(x => x[0]) ?? [];
  const escapedTitle = escapeTitle(title);
  return {
    github,
    date: datetime.toFormat('yyyy-MM-dd'),
    title: escapedTitle,
    dirPath,
    isDraft,
    tags,
    slug,
    body,
    images,
    eyecatch,
    links,
  };
}

async function writePost({ github, date, title, dirPath, tags, body }) {

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
    await file.writeFile(`---\n\n`);
    await file.writeFile(body);
    await file.close();

  } catch (error) {
    console.error(`error on write`, filePath, error);
  } finally {
    file?.close();
  }
  
}

async function processEyeCatch({ url, filename, imagePath }) {

  try {
    process.stdout.write(`  [EyeCatch] ${url} => ${filename}: `);
    if (await exists(imagePath)) {
      console.log('exists');
      return;
    }
    await downloadImage(url, imagePath);
    console.log('done');
  } catch (error) {
    console.error(`error`, error.message);
  }

}

async function processImages(images) {

  if (images.length === 0) { return; }

  for (const { url, filename, fallbackUrl, imagePath } of images) {
    try {
      process.stdout.write(`  [Image] ${url} => ${filename} : `);
      if (await exists(imagePath)) {
        console.log('exists');
        continue;
      }
      try {
        await downloadImage(url, imagePath);
        console.log('done');
        await sleep(500);
      } catch (error) {
        await downloadImage(fallbackUrl, imagePath);
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
}

async function processPost({ github, date, title, dirPath, tags, body, images, eyecatch }, { imageDownload }) {

  process.stdout.write(`${dirPath} : `);

  try {
    await ensureDir(dirPath);
  } catch (error) {
    console.error(`error on mkdir`, dirPath, error);
  }

  await writePost({ github, date, title, dirPath, tags, body });
  
  console.log('done');

  if (imageDownload) {
    const imageDirPath = path.join(dirPath, POST_IMAGE_DIR);
    try {
      await ensureDir(imageDirPath);
    } catch (error) {
      console.error(`error on mkdir (images)`, dirPath);
      throw error;
    }
    if (images?.length) {
      await processImages(images);
    }

    if (eyecatch) {
      await processEyeCatch(eyecatch);
    }
  }

  console.log('-'.repeat(100));
}

module.exports = {
  transformPost,
  processPost,
};
