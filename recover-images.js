const glob = require(`glob`)
const fs = require(`fs-extra`)
if (process.argv.length < 3 || !process.argv[2]) {
  console.error('Directory not specified')
  return
}
const dirPath = process.argv[2]

const matches = glob.sync(`${dirPath}/*.{jpg,jpeg,png}.org`)

Promise.all(
  matches.map(async match => {
    const baseName = match.replace(
      /^(.+)\..+$/,
      (match, ext) => ext
    )
    await fs.rename(match, baseName)
    console.log(match, '->', baseName)
  })
)
