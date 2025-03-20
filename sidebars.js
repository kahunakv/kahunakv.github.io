/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  // By default, Docusaurus generates a sidebar from the docs folder structure
  //tutorialSidebar: [{type: 'autogenerated', dirName: '.'}],

  // But you can create a sidebar manually
  tutorialSidebar: [
    'intro',
    'getting-started',
    'distributed-locks',
    {
      type: 'category',
      label: 'Distributed Key/Value Store',
      items: ['distributed-keyvalue-store', 'distributed-keyvalue-store/cas', 'distributed-keyvalue-store/transactions'],
    },
    {
      type: 'category',
      label: 'Scripts',
      items: ['scripts', 'scripts/set'],
    },
    {
      type: 'category',
      label: 'Tutorials',
      items: ['tutorials/distributed-locking'],
    },
    {
      type: 'category',
      label: 'Server',
      items: ['server-installation', 'configuration'],
    },
    {
      type: 'category',
      label: 'Client',
      items: ['kahuna-cli', 'dotnet-client'],
    },
  ],
};

export default sidebars;
