const mapping = {
  '社長': 'norikazum',
  'kenzauros': 'kenzauros',
  'きよしん': 'kiyoshin',
  'じんない': 'jinna-i',
  'こっしー': 'kosshii',
  'ふっくん': 'hiroki-Fukumoto',
  'k-so16': 'k-so16',
  'じゅんじゅん': 'junya-gera',
  'IwamotoKohei': 'kohei-iwamoto-wa',
  'link': 'linkohta',
};

function translateName(name) {
  return mapping[name] || '';
}

module.exports = { translateName };
