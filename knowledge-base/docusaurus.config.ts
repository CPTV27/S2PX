import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Scan2Plan Knowledge Base',
  tagline: 'Single Source of Truth — As-Built Assurance',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://kb.scan2plan.io',
  baseUrl: '/knowledge-base/',

  organizationName: 'scan2plan',
  projectName: 'knowledge-base',

  onBrokenLinks: 'ignore',

  markdown: {
    format: 'md',
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'light',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Scan2Plan',
      logo: {
        alt: 'Scan2Plan Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'knowledgeBase',
          position: 'left',
          label: 'Knowledge Base',
        },
        {
          to: '/go/studio.html',
          label: '← Back to Studio',
          position: 'right',
        },
        {
          href: 'https://scan2plan.io',
          label: 'scan2plan.io',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Knowledge Base',
          items: [
            { label: 'Overview', to: '/' },
            { label: 'Company Identity', to: '/part-1-foundation/section-01-company-identity-positioning' },
            { label: 'Pricing & Financials', to: '/part-1-foundation/section-03-financial-profile-pricing-market-position' },
            { label: 'Standards', to: '/part-3-technology/section-08-standards-technical-framework' },
          ],
        },
        {
          title: 'Quick Links',
          items: [
            { label: 'FY2026 Strategy', to: '/part-4-strategy/section-10-fy2026-strategy' },
            { label: 'Services & Deliverables', to: '/part-3-technology/section-09-services-deliverables-coverage' },
            { label: 'Buyer Personas', to: '/part-2-sales/section-06-buyer-personas' },
            { label: 'Data Dictionary', to: '/appendix/appendix-b-data-dictionary' },
          ],
        },
        {
          title: 'Company',
          items: [
            { label: 'Website', href: 'https://scan2plan.io' },
            { label: 'Phone: (518) 362-2403', href: 'tel:5183622403' },
            { label: 'Email: info@scan2plan.io', href: 'mailto:info@scan2plan.io' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Scan2Plan, Inc. | Master Knowledge Base v4.0`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
