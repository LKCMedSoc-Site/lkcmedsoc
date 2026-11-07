'use client';
import * as React from 'react';
import { PlasmicRootProvider } from '@plasmicapp/loader-nextjs';
import { PLASMIC } from './plasmic-init';
import LiveNews from '@/components/LiveNews';
import LiveEvents from '@/components/LiveEvents';
import TeamBlock from '@/components/TeamBlock';
import Avatar from '@/components/Avatar';

export function ClientPlasmicRootProvider(props: Omit<React.ComponentProps<typeof PlasmicRootProvider>, 'loader'>) {
  return <PlasmicRootProvider loader={PLASMIC} {...props} />;
}

// The pieces that appear in Plasmic's "Add" menu. They show real, live data.
PLASMIC.registerComponent(LiveNews, {
  name: 'LiveNews',
  displayName: 'News list (live)',
  description: 'Latest published news cards, from our database.',
  props: {
    category: { type: 'choice', options: ['All', 'Impact', 'Events', 'Announcements', 'Stories'], defaultValue: 'All' },
    count: { type: 'number', defaultValue: 6, displayName: 'How many' },
    columns: { type: 'choice', options: ['1', '2', '3'], defaultValue: '3' },
  },
  importPath: '@/components/LiveNews',
});

PLASMIC.registerComponent(LiveEvents, {
  name: 'LiveEvents',
  displayName: 'Events list (live)',
  description: 'Upcoming events open to the public, from our database.',
  props: {
    count: { type: 'number', defaultValue: 10, displayName: 'How many' },
  },
  importPath: '@/components/LiveEvents',
});

// Layout pieces for Plasmic. Drag them onto a page, then change the words, photos and links in the right-hand panel.
import Hero from '@/components/blocks/Hero';
import Marquee from '@/components/blocks/Marquee';
import PhotoTile from '@/components/blocks/PhotoTile';
import SectionHead from '@/components/blocks/SectionHead';
import Reveal from '@/components/blocks/Reveal';
import SafeImage from '@/components/SafeImage';

PLASMIC.registerComponent(Hero, {
  name: 'Hero', displayName: 'Photo hero (fixed layout)', description: 'Ready-made hero. Only its words, photo and button links can be changed. For a hero you can edit freely use "Hero layout (editable)".',
  props: {
    title: { type: 'string', defaultValue: 'We are LKCMedSoc' }, tagline: { type: 'string' },
    image: { type: 'imageUrl', displayName: 'Photo' },
    primaryLabel: { type: 'string', defaultValue: 'See events' }, primaryHref: { type: 'string', defaultValue: '/events' },
    secondaryLabel: { type: 'string', defaultValue: 'Meet the team' }, secondaryHref: { type: 'string', defaultValue: '/about/meet-the-team' },
  },
  importPath: '@/components/blocks/Hero',
});
PLASMIC.registerComponent(Marquee, {
  name: 'Marquee', displayName: 'Scrolling words', description: 'A slow scrolling strip of words.',
  props: { words: { type: 'string', defaultValue: 'Service, Events, Academic, Community', displayName: 'Words (separated by commas)' } },
  importPath: '@/components/blocks/Marquee',
});
PLASMIC.registerComponent(PhotoTile, {
  name: 'PhotoTile', displayName: 'Photo card (fixed layout)', description: 'Ready-made photo card. For one you can edit freely use "Photo card (editable)".',
  props: {
    title: { type: 'string', defaultValue: 'Title' }, text: { type: 'string' },
    image: { type: 'imageUrl', displayName: 'Photo' }, href: { type: 'string', displayName: 'Links to', defaultValue: '/' },
    ratio: { type: 'choice', options: ['3/4', '4/5', '1/1', '4/3', '16/9'], defaultValue: '3/4', displayName: 'Shape' },
  },
  importPath: '@/components/blocks/PhotoTile',
});
PLASMIC.registerComponent(SectionHead, {
  name: 'SectionHead', displayName: 'Section heading', description: 'Small label, big heading, optional link.',
  props: {
    eyebrow: { type: 'string', displayName: 'Small label' }, title: { type: 'string', defaultValue: 'Heading' },
    linkLabel: { type: 'string' }, linkHref: { type: 'string' }, light: { type: 'boolean', displayName: 'For dark background' },
  },
  importPath: '@/components/blocks/SectionHead',
});
PLASMIC.registerComponent(Reveal, {
  name: 'Reveal', displayName: 'Fade in on scroll', description: 'Wrap anything to make it fade in when it scrolls into view.',
  props: { children: 'slot', delay: { type: 'number', defaultValue: 0, displayName: 'Delay (ms)' } },
  importPath: '@/components/blocks/Reveal',
});
PLASMIC.registerComponent(SafeImage, {
  name: 'SafeImage', displayName: 'Photo', description: 'A photo that resizes itself and never shows a broken box.',
  props: {
    src: { type: 'imageUrl', displayName: 'Photo' }, alt: { type: 'string', displayName: 'Description (for screen readers)' },
    ratio: { type: 'choice', options: ['16/9', '4/3', '1/1', '3/4'], defaultValue: '4/3', displayName: 'Shape' },
  },
  importPath: '@/components/SafeImage',
});

// ---------------------------------------------------------------------------------------------------------------------------
// Everything below is for designing whole pages in Plasmic Studio.
//  - Create pages at the real paths (/, /events, /news, /student-groups, /resources, /about/meet-the-team, /about/houses): when one is
//    published it replaces the coded page; otherwise the coded page shows.
//  - Create Plasmic components named exactly "Header" and "Footer" to replace the site header and footer the same way.
//  - Build them from the blocks below plus Plasmic's own boxes, text and images. The blocks that show live data load it themselves.
// ---------------------------------------------------------------------------------------------------------------------------
import Band from '@/components/blocks/Band';
import SlantPhoto from '@/components/blocks/SlantPhoto';
import PageHero from '@/components/blocks/PageHero';
import Counter from '@/components/blocks/Counter';
import DisplayText from '@/components/blocks/DisplayText';
import PillButton from '@/components/blocks/PillButton';
import HeroLayout from '@/components/blocks/HeroLayout';
import PhotoCardShell from '@/components/blocks/PhotoCardShell';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import NavMenu from '@/components/nav/NavMenu';
import MobileMenu from '@/components/nav/MobileMenu';
import SiteSearch from '@/components/SiteSearch';
import EventsBlock from '@/components/EventsBlock';
import GroupsBlock from '@/components/GroupsBlock';
import NewsBlock from '@/components/NewsBlock';
import CcaSpotlightBlock from '@/components/CcaSpotlightBlock';

// The site's colours and fonts, as tokens you can pick from in Studio. They follow the values in the site's stylesheet.
const colour = (name: string, displayName: string, cssVar: string) => PLASMIC.registerToken({ name, displayName, type: 'color', value: `var(--color-${cssVar})` });
colour('plum-darkest', 'Plum, darkest (header, footer)', 'p950');
colour('plum', 'Plum', 'p900');
colour('magenta', 'Magenta', 'p500');
colour('orchid', 'Orchid', 'p300');
colour('pale', 'Pale', 'p50');
colour('lilac', 'Lilac', 'lilac');
colour('mist', 'Mist', 'mist');
colour('pink', 'Pink', 'pink');
colour('yellow', 'Yellow (notices only)', 'acid');
colour('grey', 'Grey', 'silver');
colour('ink', 'Text', 'ink');
PLASMIC.registerToken({ name: 'font-display', displayName: 'Display font (DIN Engschrift)', type: 'font-family', value: "'DIN Engschrift', 'DIN', 'Arial Narrow', sans-serif" });
PLASMIC.registerToken({ name: 'font-body', displayName: 'Body font (DIN)', type: 'font-family', value: "'DIN', 'DIN Alternate', 'Barlow', 'Segoe UI', system-ui, sans-serif" });

// Layout
PLASMIC.registerComponent(Band, {
  name: 'Band', displayName: 'Page band (slanted)', description: 'A coloured section cut on the brand slant. Stack them down the page; each needs a Stack order one higher than the band above.',
  props: {
    children: 'slot',
    tone: { type: 'choice', options: ['plum', 'grape', 'magenta', 'pale', 'grey', 'mist', 'pink'], defaultValue: 'pale', displayName: 'Colour' },
    order: { type: 'number', defaultValue: 0, displayName: 'Stack order (0 = the top band)' },
    last: { type: 'boolean', displayName: 'Last section (the footer tucks under it)' },
    contained: { type: 'boolean', defaultValue: true, displayName: 'Keep content in the centre column' },
  },
  importPath: '@/components/blocks/Band',
});
PLASMIC.registerComponent(SlantPhoto, {
  name: 'SlantPhoto', displayName: 'Photo on the slant', description: 'A photo cut on the brand slant, optionally with the lilac slab behind it.',
  props: {
    src: { type: 'imageUrl', displayName: 'Photo' },
    ratio: { type: 'choice', options: ['16/10', '16/9', '4/3', '4/5', '1/1'], defaultValue: '16/10', displayName: 'Shape' },
    slab: { type: 'boolean', displayName: 'Lilac slab behind' },
  },
  importPath: '@/components/blocks/SlantPhoto',
});
PLASMIC.registerComponent(PageHero, {
  name: 'PageHero', displayName: 'Page title band', description: 'The dark band with a big title at the top of inner pages.',
  props: { title: { type: 'string', defaultValue: 'Page title' }, intro: { type: 'string' }, children: 'slot' },
  importPath: '@/components/blocks/PageHero',
});
PLASMIC.registerComponent(Counter, {
  name: 'Counter', displayName: 'Counting number', description: 'A number that counts up when it scrolls into view ("800+" counts to 800).',
  props: { value: { type: 'string', defaultValue: '800+' } },
  importPath: '@/components/blocks/Counter',
});

// Header and footer: ready-made, or build your own from the parts
PLASMIC.registerComponent(Header, {
  name: 'SiteHeader', displayName: 'Site header (ready-made)', description: 'The whole header: logo, menu, search, Apply, and the phone menu.',
  props: {}, importPath: '@/components/Header',
});
PLASMIC.registerComponent(Footer, {
  name: 'SiteFooter', displayName: 'Site footer (ready-made)', description: 'The whole footer.',
  props: {}, importPath: '@/components/Footer',
});
PLASMIC.registerComponent(NavMenu, {
  name: 'NavMenu', displayName: 'Menu (desktop)', description: 'The main menu with drop-down panels, read from the site menu. Place it inside a bar set to position: relative.',
  props: {}, importPath: '@/components/nav/NavMenu',
});
PLASMIC.registerComponent(MobileMenu, {
  name: 'MobileMenu', displayName: 'Menu button (phones)', description: 'A round button that opens the full-screen phone menu.',
  props: {}, importPath: '@/components/nav/MobileMenu',
});
PLASMIC.registerComponent(SiteSearch, {
  name: 'SiteSearch', displayName: 'Search button', description: 'Opens the search for pages and CCAs.',
  props: { label: { type: 'string', defaultValue: 'Search' } }, importPath: '@/components/SiteSearch',
});

// Live blocks (they load their own data)
PLASMIC.registerComponent(EventsBlock, {
  name: 'EventsBlock', displayName: 'Events with filters (live)', description: 'All upcoming events with search, committee, month and RSVP filters.',
  props: {}, importPath: '@/components/EventsBlock',
});
PLASMIC.registerComponent(GroupsBlock, {
  name: 'GroupsBlock', displayName: 'Student groups cards (live)', description: 'Every CCA as a card, with search and committee filters.',
  props: {}, importPath: '@/components/GroupsBlock',
});
PLASMIC.registerComponent(NewsBlock, {
  name: 'NewsBlock', displayName: 'News cards with filters (live)', description: 'Latest stories as cards, with category and committee filters.',
  props: {
    count: { type: 'number', defaultValue: 12, displayName: 'How many' },
    showFilters: { type: 'boolean', defaultValue: true, displayName: 'Show the filters' },
  },
  importPath: '@/components/NewsBlock',
});
PLASMIC.registerComponent(TeamBlock, {
  name: 'TeamBlock', displayName: 'Meet the team (live)', description: 'One part of Meet the Team, from the live records: ExCo, the committees with their heads, or year and stream representatives. Add one per part, each in its own section.',
  props: {
    part: { type: 'choice', options: ['exco', 'committees', 'years'], defaultValue: 'exco', displayName: 'Which part' },
    showHeading: { type: 'boolean', defaultValue: true, displayName: 'Show its heading' },
  },
  importPath: '@/components/TeamBlock',
});
PLASMIC.registerComponent(Avatar, {
  name: 'Avatar', displayName: 'Person photo (round)', description: 'A round photo, or initials when there is no photo. Use it to design your own people cards.',
  props: {
    name: { type: 'string', defaultValue: 'Alex Tan' },
    photo: { type: 'imageUrl', displayName: 'Photo' },
    size: { type: 'number', defaultValue: 64, displayName: 'Size (px)' },
    dark: { type: 'boolean', defaultValue: false, displayName: 'For dark backgrounds' },
  },
  importPath: '@/components/Avatar',
});
PLASMIC.registerComponent(CcaSpotlightBlock, {
  name: 'CcaSpotlightBlock', displayName: 'CCA spotlight (live)', description: "This week's featured CCA and the list of committees.",
  props: { panel: { type: 'boolean', defaultValue: true, displayName: 'Dark panel behind it' } },
  importPath: '@/components/CcaSpotlightBlock',
});

// ---------------------------------------------------------------------------------------------------------------------------
// Editable shells: the coded part keeps the brand shape (slanted band, photo frame); what goes inside is yours to edit and move.
// ---------------------------------------------------------------------------------------------------------------------------
PLASMIC.registerComponent(DisplayText, {
  name: 'DisplayText', displayName: 'Display text', description: 'Words in the big condensed brand face, in capitals. Pick a size and colour.',
  props: {
    text: { type: 'string', defaultValue: 'Heading' },
    size: { type: 'choice', options: ['hero', 'xl', 'lg', 'md', 'sm'], defaultValue: 'xl', displayName: 'Size' },
    tone: { type: 'choice', options: ['plum', 'dark', 'white', 'pink', 'orchid', 'magenta', 'mist'], defaultValue: 'plum', displayName: 'Colour' },
    as: { type: 'choice', options: ['h1', 'h2', 'h3', 'p'], defaultValue: 'h2', displayName: 'Page role (h1 is the main title)' },
  },
  importPath: '@/components/blocks/DisplayText',
});
PLASMIC.registerComponent(PillButton, {
  name: 'PillButton', displayName: 'Button (pill)', description: 'A rounded button or link in the brand style.',
  props: {
    label: { type: 'string', defaultValue: 'Button' },
    href: { type: 'string', defaultValue: '/', displayName: 'Links to' },
    look: { type: 'choice', options: ['pink', 'plum', 'white', 'outline-light', 'outline-dark'], defaultValue: 'pink', displayName: 'Look' },
  },
  importPath: '@/components/blocks/PillButton',
});
PLASMIC.registerComponent(HeroLayout, {
  name: 'HeroLayout', displayName: 'Hero layout (editable)',
  description: 'A slanted band with two areas: words on one side, a picture on the other. Fill both with your own boxes, text, buttons and photo.',
  props: {
    tone: { type: 'choice', options: ['plum', 'grape', 'magenta', 'pale', 'grey', 'mist', 'pink'], defaultValue: 'plum', displayName: 'Colour' },
    order: { type: 'number', defaultValue: 0, displayName: 'Stack order (0 = the top band)' },
    last: { type: 'boolean', displayName: 'Last section (the footer tucks under it)' },
    mediaSide: { type: 'choice', options: ['right', 'left'], defaultValue: 'right', displayName: 'Picture on the' },
    children: {
      type: 'slot', displayName: 'Words',
      defaultValue: [{
        type: 'vbox', styles: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '20px' },
        children: [
          { type: 'component', name: 'DisplayText', props: { text: 'We are LKCMedSoc', size: 'hero', tone: 'white', as: 'h1' } },
          { type: 'text', value: 'A short line about this page. Click to edit it, or delete it.' },
          { type: 'hbox', styles: { display: 'flex', gap: '12px', flexWrap: 'wrap' }, children: [
            { type: 'component', name: 'PillButton', props: { label: 'See events', href: '/events', look: 'pink' } },
            { type: 'component', name: 'PillButton', props: { label: 'Meet the team', href: '/about/meet-the-team', look: 'outline-light' } },
          ] },
        ],
      }],
    },
    media: { type: 'slot', displayName: 'Picture', defaultValue: [{ type: 'component', name: 'SlantPhoto', props: { ratio: '4/5', slab: true } }] },
  },
  importPath: '@/components/blocks/HeroLayout',
});
PLASMIC.registerComponent(PhotoCardShell, {
  name: 'PhotoCardShell', displayName: 'Photo card (editable)',
  description: 'A tall photo card. Put your own heading and text inside; they sit at the bottom of the photo.',
  props: {
    image: { type: 'imageUrl', displayName: 'Photo' },
    href: { type: 'string', displayName: 'Links to (optional)' },
    ratio: { type: 'choice', options: ['3/4', '4/5', '1/1', '4/3', '16/9'], defaultValue: '3/4', displayName: 'Shape' },
    children: {
      type: 'slot', displayName: 'Words on the photo',
      defaultValue: [{
        type: 'vbox', styles: { display: 'flex', flexDirection: 'column', gap: '8px' },
        children: [
          { type: 'component', name: 'DisplayText', props: { text: 'Title', size: 'lg', tone: 'white', as: 'h3' } },
          { type: 'text', value: 'A line about it.' },
        ],
      }],
    },
  },
  importPath: '@/components/blocks/PhotoCardShell',
});
