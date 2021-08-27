function loadYamlFile(filename) {
  const fs = require('fs');
  const yaml = require('js-yaml');
  const yamlText = fs.readFileSync(filename, 'utf8')
  return yaml.load(yamlText);
}

module.exports = { loadYamlFile };
