// Ejected from @docusaurus/theme-mermaid so each color mode gets its own
// themeVariables. The stock component shares one options object across modes.
import React, {useEffect, useMemo, useRef, useState} from 'react';
import ErrorBoundary from '@docusaurus/ErrorBoundary';
import {
  ErrorBoundaryErrorMessageFallback,
  useColorMode,
} from '@docusaurus/theme-common';
import {
  MermaidContainerClassName,
  useMermaidConfig,
} from '@docusaurus/theme-mermaid/client';
import styles from './styles.module.css';

// Mermaid is a mutable singleton: initialize() and render() must not
// interleave. A page that loads in dark mode renders each diagram twice
// (light, then dark); overlapping renders that share an element id leave a
// diagram empty. Run renders one at a time, give each its own id, and drop
// results that a newer render has replaced.
let renderQueue = Promise.resolve();
let renderCount = 0;

function renderSerially(task) {
  const next = renderQueue.then(task, task);
  renderQueue = next.catch(() => {});
  return next;
}

async function renderMermaid(text, config) {
  const mermaid = (await import('mermaid')).default;
  const id = `mermaid-svg-${++renderCount}`;
  mermaid.initialize(config);
  try {
    return await mermaid.render(id, text);
  } catch (e) {
    // Mermaid leaves an error element in the DOM when parsing fails.
    document.querySelector(`#d${id}`)?.remove();
    throw e;
  }
}

function useMermaidRenderResult({text, config}) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    let current = true;
    renderSerially(() => renderMermaid(text, config))
      .then((rendered) => {
        if (current) setResult(rendered);
      })
      .catch((e) => {
        if (current) {
          // Rethrow during render so the error boundary shows the failure.
          setResult(() => {
            throw e;
          });
        }
      });
    return () => {
      current = false;
    };
  }, [text, config]);
  return result;
}

const fontFamily = "'Inter Variable', system-ui, sans-serif";

// Logo palette, so diagrams match the site colors.
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

// Fill for nodes a diagram marks with `:::leader` (for example a partition
// leader), so diagrams never hard-code colors.
const leaderColors = {
  light: {fill: '#02874c', stroke: '#00241a', text: '#ffffff'},
  dark: {fill: '#1bbc49', stroke: '#6bd54f', text: '#00241a'},
};

// Rounded corners for plain nodes and subgraphs.
function themeCSS(colorMode) {
  const leader = leaderColors[colorMode];
  return `
  .node rect, .node .label-container { rx: 8px; ry: 8px; }
  .cluster rect { rx: 12px; ry: 12px; }
  .cluster-label .nodeLabel { font-weight: 700; }
  .node.leader rect, .node.leader polygon, .node.leader path { fill: ${leader.fill}; stroke: ${leader.stroke}; }
  .node.leader .nodeLabel, .node.leader .nodeLabel p { color: ${leader.text}; }
  .node.leader text { fill: ${leader.text}; }
`;
}

function useKahunaMermaidConfig() {
  const {colorMode} = useColorMode();
  const config = useMermaidConfig();
  return useMemo(
    () => ({
      ...config,
      themeVariables: {...palettes[colorMode], ...config.themeVariables},
      themeCSS: `${themeCSS(colorMode)}${config.themeCSS ?? ''}`,
    }),
    [colorMode, config],
  );
}

function MermaidRenderResult({renderResult}) {
  const ref = useRef(null);
  useEffect(() => {
    const div = ref.current;
    renderResult.bindFunctions?.(div);
    // Keep labels legible on narrow screens: a wide diagram never shrinks
    // below 70% of its natural size; its container scrolls instead.
    const svg = div.querySelector('svg');
    const width = svg?.viewBox?.baseVal?.width;
    if (width) {
      svg.style.minWidth = `${Math.round(width * 0.7)}px`;
    }
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
