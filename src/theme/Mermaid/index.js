// Ejected from @docusaurus/theme-mermaid so each color mode gets its own
// themeVariables. The stock component shares one options object across modes.
import React, {useEffect, useMemo, useRef} from 'react';
import ErrorBoundary from '@docusaurus/ErrorBoundary';
import {
  ErrorBoundaryErrorMessageFallback,
  useColorMode,
} from '@docusaurus/theme-common';
import {
  MermaidContainerClassName,
  useMermaidConfig,
  useMermaidRenderResult,
} from '@docusaurus/theme-mermaid/client';
import styles from './styles.module.css';

const fontFamily = "'Inter Variable', system-ui, sans-serif";

// Logo palette, same as src/components/Diagrams, so both diagram kinds match.
const palettes = {
  light: {
    darkMode: false,
    fontFamily,
    background: '#ffffff',
    primaryColor: '#e4f7e9',
    primaryTextColor: '#00241a',
    primaryBorderColor: '#1bbc49',
    secondaryColor: '#f1fbf4',
    tertiaryColor: '#f1fbf4',
    mainBkg: '#e4f7e9',
    nodeBorder: '#1bbc49',
    textColor: '#00241a',
    titleColor: '#00241a',
    lineColor: '#02874c',
    clusterBkg: '#f1fbf4',
    clusterBorder: '#98e1ad',
    edgeLabelBackground: '#ffffff',
    noteBkgColor: '#f1fbf4',
    noteBorderColor: '#98e1ad',
    noteTextColor: '#00241a',
    actorBkg: '#e4f7e9',
    actorBorder: '#1bbc49',
    actorTextColor: '#00241a',
    actorLineColor: '#98e1ad',
    signalColor: '#02874c',
    signalTextColor: '#00241a',
    labelBoxBkgColor: '#f1fbf4',
    labelBoxBorderColor: '#98e1ad',
    labelTextColor: '#00241a',
    loopTextColor: '#00241a',
  },
  dark: {
    darkMode: true,
    fontFamily,
    background: '#1b1b1d',
    primaryColor: '#003824',
    primaryTextColor: '#f1fbf4',
    primaryBorderColor: '#1bbc49',
    secondaryColor: '#00241a',
    tertiaryColor: '#00241a',
    mainBkg: '#003824',
    nodeBorder: '#1bbc49',
    textColor: '#f1fbf4',
    titleColor: '#f1fbf4',
    lineColor: '#6bd54f',
    clusterBkg: '#00241a',
    clusterBorder: '#015a36',
    edgeLabelBackground: '#1b1b1d',
    noteBkgColor: '#00241a',
    noteBorderColor: '#015a36',
    noteTextColor: '#f1fbf4',
    actorBkg: '#003824',
    actorBorder: '#1bbc49',
    actorTextColor: '#f1fbf4',
    actorLineColor: '#015a36',
    signalColor: '#6bd54f',
    signalTextColor: '#f1fbf4',
    labelBoxBkgColor: '#00241a',
    labelBoxBorderColor: '#015a36',
    labelTextColor: '#f1fbf4',
    loopTextColor: '#f1fbf4',
  },
};

// Rounded corners for plain nodes and subgraphs.
const themeCSS = `
  .node rect, .node .label-container { rx: 8px; ry: 8px; }
  .cluster rect { rx: 12px; ry: 12px; }
  .cluster-label .nodeLabel { font-weight: 700; }
`;

function useKahunaMermaidConfig() {
  const {colorMode} = useColorMode();
  const config = useMermaidConfig();
  return useMemo(
    () => ({
      ...config,
      themeVariables: {...palettes[colorMode], ...config.themeVariables},
      themeCSS: `${themeCSS}${config.themeCSS ?? ''}`,
    }),
    [colorMode, config],
  );
}

function MermaidRenderResult({renderResult}) {
  const ref = useRef(null);
  useEffect(() => {
    const div = ref.current;
    renderResult.bindFunctions?.(div);
  }, [renderResult]);
  return (
    <div
      ref={ref}
      className={`${MermaidContainerClassName} ${styles.container}`}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{__html: renderResult.svg}}
    />
  );
}

function MermaidRenderer({value}) {
  const config = useKahunaMermaidConfig();
  const renderResult = useMermaidRenderResult({text: value, config});
  if (renderResult === null) {
    return null;
  }
  return <MermaidRenderResult renderResult={renderResult} />;
}

export default function Mermaid(props) {
  return (
    <ErrorBoundary
      fallback={(params) => <ErrorBoundaryErrorMessageFallback {...params} />}>
      <MermaidRenderer {...props} />
    </ErrorBoundary>
  );
}
