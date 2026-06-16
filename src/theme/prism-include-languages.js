import siteConfig from '@generated/docusaurus.config';

function includeConfiguredLanguages(PrismObject) {
  const {
    themeConfig: {prism},
  } = siteConfig;
  const {additionalLanguages} = prism;

  additionalLanguages.forEach((lang) => {
    if (lang === 'php') {
      require('prismjs/components/prism-markup-templating.js');
    }

    require(`prismjs/components/prism-${lang}`);
  });
}

function registerKahunaLanguage(PrismObject) {
  const keywords = [
    'as',
    'at',
    'begin',
    'bucket',
    'by',
    'commit',
    'del',
    'delete',
    'do',
    'edel',
    'edelete',
    'eexists',
    'eextend',
    'eget',
    'else',
    'end',
    'escan',
    'eset',
    'ex',
    'exists',
    'extend',
    'for',
    'found',
    'get',
    'if',
    'in',
    'let',
    'norev',
    'nx',
    'of',
    'prefix',
    'return',
    'rollback',
    'scan',
    'set',
    'sleep',
    'then',
    'throw',
    'xx',
  ].join('|');

  PrismObject.languages.kahuna = {
    string: {
      pattern:
        /(["'])(?:\\(?:[^\r\n]|[0-7]{3}|x[\da-fA-F]{2}|u[\da-fA-F]{4}|U[\da-fA-F]{8})|(?!\1)[^\\\r\n])*\1/,
      greedy: true,
    },
    placeholder: {
      pattern: /@[a-zA-Z0-9_]+/,
      alias: 'variable',
    },
    'escaped-identifier': {
      pattern:
        /`(?:\\(?:[^\r\n]|[0-7]{3}|x[\da-fA-F]{2}|u[\da-fA-F]{4}|U[\da-fA-F]{8})|[^\\`\r\n])*`/,
      alias: 'symbol',
    },
    comment: /#.*/,
    float: {
      pattern: /(^|[^\w.])-?\d+\.\d+(?![\w.])/,
      lookbehind: true,
      alias: 'number',
    },
    number: {
      pattern: /(^|[^\w.])-?(?:0x[\da-fA-F]+|\d+)(?![\w.])/,
      lookbehind: true,
    },
    boolean: {
      pattern: /\b(?:false|true|null)\b/i,
      alias: 'constant',
    },
    range: {
      pattern: /\.\./,
      alias: 'operator',
    },
    command: {
      pattern:
        /\b(?:cmp|cmprev|del|delete|edel|edelete|eexists|eextend|eget|escan|eset|exists|extend|get|scan|set)\b/i,
      alias: 'builtin',
    },
    keyword: new RegExp(`\\b(?:${keywords})\\b`, 'i'),
    function: /\b[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\()/,
    variable: /\b[a-zA-Z_][a-zA-Z0-9_]*\b/,
    operator: /(?:==|<>|!=|<=|>=|&&|\|\||[=<>+\-*/!@])/,
    punctuation: /[()[\]{},]/,
  };

  PrismObject.languages.kahunascript = PrismObject.languages.kahuna;
  PrismObject.languages['kahuna-script'] = PrismObject.languages.kahuna;
}

export default function prismIncludeLanguages(PrismObject) {
  const PrismBefore = globalThis.Prism;
  globalThis.Prism = PrismObject;

  includeConfiguredLanguages(PrismObject);
  registerKahunaLanguage(PrismObject);

  delete globalThis.Prism;
  if (typeof PrismBefore !== 'undefined') {
    globalThis.Prism = PrismBefore;
  }
}
