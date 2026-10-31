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
    'case',
    'cmp',
    'cmprev',
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
    'not',
    'nx',
    'of',
    'prefix',
    'return',
    'rollback',
    'scan',
    'set',
    'sleep',
    'switch',
    'then',
    'throw',
    'xx',
  ].join('|');

  PrismObject.languages.kahuna = {
    // Strings may span several lines; escaped identifiers may not.
    string: {
      pattern:
        /(["'])(?:\\(?:[^\r\n]|[0-7]{3}|x[\da-fA-F]{2}|u[\da-fA-F]{4}|U[\da-fA-F]{8})|(?!\1)[^\\])*\1/,
      greedy: true,
    },
    // Before placeholders, so a key such as `user@domain.com` stays one token.
    'escaped-identifier': {
      pattern:
        /`(?:\\(?:[^\r\n]|[0-7]{3}|x[\da-fA-F]{2}|u[\da-fA-F]{4}|U[\da-fA-F]{8})|[^\\`\r\n])*`/,
      greedy: true,
      alias: 'symbol',
    },
    placeholder: {
      pattern: /@[a-zA-Z0-9_]+/,
      alias: 'variable',
    },
    // Before numbers, so both endpoints of `1..10` are numbers.
    range: {
      pattern: /\.\./,
      alias: 'operator',
    },
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
    // `not deleted` and `not extended` are single result guards; `deleted`
    // and `extended` alone are ordinary identifiers.
    guard: {
      pattern: /\bnot\s+(?:deleted|extended)\b/i,
      alias: 'keyword',
    },
    command: {
      pattern:
        /\b(?:del|delete|edel|edelete|eexists|eextend|eget|escan|eset|exists|extend|get|scan|set)\b/i,
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
