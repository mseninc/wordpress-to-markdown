// https://www.gatsbyjs.com/docs/preoptimizing-images/

const sharp = require(`sharp`)
const glob = require(`glob`)
const fs = require(`fs-extra`)

const MAX_SIZE = 500 * 1024;
const MAX_WIDTH = 1200
const QUALITY = 70

function fileSize(size) {
  return ('      ' + Math.round(size / 1024.0)).slice(-6)
}

async function optimizeImage(fileName) {
  try {
    const orgStat = fs.statSync(fileName)
    const stream = sharp(fileName)
    const info = await stream.metadata()
    // console.log(`${fileName}: ${info.width}x${info.height} ${fileSize(orgStat.size)}`)
    if (info.width < MAX_WIDTH && info.height < MAX_WIDTH && orgStat.size < MAX_SIZE) {
      return 0
    }
    const needResize = info.width >= MAX_WIDTH || info.height >= MAX_WIDTH
    const pngName = fileName.replace(/(\..+)$/, (_, ext) => `-optimized.png`)
    const jpgName = fileName.replace(/(\..+)$/, (_, ext) => `-optimized.jpg`)
    if (needResize) {
      stream.resize(MAX_WIDTH, MAX_WIDTH, { fit: 'inside' })
    }
    // png
    const pngResult = await stream.png({ quality: QUALITY }).toFile(pngName)
    // jpg
    const jpgResult = await stream.jpeg({ quality: QUALITY }).toFile(jpgName)

    if (orgStat.size < pngResult.size && orgStat.size < jpgResult.size) {
      await fs.remove(pngName)
      await fs.remove(jpgName)
      return 0
    }
    await fs.copy(fileName, `${fileName}.org`) // backup

    const optimizedFile = pngResult.size < jpgResult.size ? pngName : jpgName
    await fs.rename(optimizedFile, fileName)
    await fs.remove(pngResult.size < jpgResult.size ? jpgName : pngName) // remove rest file

    const resultSize = pngResult.size < jpgResult.size ? pngResult.size : jpgResult.size
    console.log(`${fileName}: ${fileSize(orgStat.size)} => ${fileSize(resultSize)}; ${fileSize(orgStat.size - resultSize)}KB reduced`)

    return orgStat.size - resultSize

  } catch (error) {
    console.error(`${fileName}: ${error.message}`)
  }
}

(async () => {
  if (process.argv.length < 3 || !process.argv[2]) {
    console.error('Directory not specified')
    return
  }
  const dirPath = process.argv[2]
  const matches = glob.sync(`${dirPath}/**/*.{jpg,jpeg,png}`)
  console.log(`${matches.length} files matched`)
  let reduced = 0
  for (const fileName of matches.filter(x => !x.match(/optimized\./))) {
    reduced += await optimizeImage(fileName)
  }
  console.log(`${fileSize(reduced)}KB reduced`)
})();
