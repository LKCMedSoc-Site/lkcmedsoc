'use client';
import * as React from 'react';
import { PlasmicRootProvider } from '@plasmicapp/loader-nextjs';
import { PLASMIC } from './plasmic-init';
import LiveNews from '@/components/LiveNews';
import LiveEvents from '@/components/LiveEvents';

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
  name: 'Hero', displayName: 'Photo hero', description: 'Full-width photo with a big headline and two buttons.',
  props: {
    title: { type: 'string', defaultValue: 'We are LKCMedSoc' }, tagline: { type: 'string' },
    image: { type: 'imageUrl', displayName: 'Photo' },
    primaryLabel: { type: 'string', defaultValue: 'See events' }, primaryHref: { type: 'string', defaultValue: '/events' },
    secondaryLabel: { type: 'string', defaultValue: 'Meet the team' }, secondaryHref: { type: 'string', defaultValue: '/about' },
  },
  importPath: '@/components/blocks/Hero',
});
PLASMIC.registerComponent(Marquee, {
  name: 'Marquee', displayName: 'Scrolling words', description: 'A slow scrolling strip of words.',
  props: { words: { type: 'string', defaultValue: 'Service, Events, Academic, Community', displayName: 'Words (separated by commas)' } },
  importPath: '@/components/blocks/Marquee',
});
PLASMIC.registerComponent(PhotoTile, {
  name: 'PhotoTile', displayName: 'Photo card', description: 'Tall photo card with a title and a link.',
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
