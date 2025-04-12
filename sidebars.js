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
    {
      type: 'category',
      label: 'Tutorials',
      items: ['intro', 'tutorials/distributed-locking', 'tutorials/distributed-sequencer'],
    },
    'getting-started',
    {
      type: 'category',
      label: 'Distributed Locks',
      items: ['distributed-locks', 'distributed-locks/leases', 'distributed-locks/fencing-tokens'],
    },
    {
      type: 'category',
      label: 'Distributed Key/Value Store',
      items: ['distributed-keyvalue-store', 'distributed-keyvalue-store/cas', 'distributed-keyvalue-store/revisions', 'distributed-keyvalue-store/transactions'],
    },
    'distributed-sequencer',
    {
      type: 'category',
      label: 'Scripts',
      items: ['scripts', 'scripts/commands/set', 'scripts/commands/eset', 'scripts/commands/get'],
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
    {
      type: 'category',
      label: 'Architecture',
      items: ['architecture/overview', 'architecture/distributed-transactions', 'architecture/raft', 'architecture/durability-levels'],
    },
    {
      type: 'category',
      label: 'Recipes',
      items: ['recipes/rate-limiting', 'recipes/service-discoverability'],
    },
  ],
};

export default sidebars;
