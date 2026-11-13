'use client';
import * as React from 'react';
import { PlasmicRootProvider } from '@plasmicapp/loader-nextjs';
import { PLASMIC } from './plasmic-init';
import LiveNews from '@/components/LiveNews';
import LiveEvents from '@/components/LiveEvents';
import TeamBlock from '@/components/TeamBlock';
import PeopleList from '@/components/PeopleList';
import EventsHub from '@/components/hubs/EventsHub';
import NewsHub from '@/components/hubs/NewsHub';
import PeopleHub from '@/components/hubs/PeopleHub';
import PolicyHub from '@/components/hubs/PolicyHub';
import PolicyDocHub from '@/components/hubs/PolicyDocHub';
import { PolicyEditRoot, PolicyModeSwitch, PolicyProposals, PolicyAddProvision, PolicyEditable, PolicyExcoDocuments, PolicyProvisionText } from '@/components/policy/PolicyEditParts';
import GroupsHub from '@/components/groups/GroupsHub';
import GroupsList from '@/components/groups/GroupsList';
import { GroupsSearch, GroupsCommitteeChips, GroupsRecruitingToggle, GroupsClear, GroupsCount } from '@/components/groups/GroupsFilters';
import { GroupText, GroupImage, GroupBadge, GroupRecruiting, GroupLink } from '@/components/groups/GroupParts';
import { PersonText, PersonPhoto, PersonLink } from '@/components/PersonParts';
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
    category: { type: 'string', defaultValue: 'All', helpText: 'A category name exactly as it appears in the Gazette (All shows every category).' },
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
// Header building blocks: behaviour from code, everything inside is designed in Studio.
// The site's own header with its content editable. Student Groups' sub-items come from the database, so they are left empty here.
const linkFields = { label: { type: 'string' as const }, href: { type: 'string' as const, displayName: 'Link' }, note: { type: 'string' as const, displayName: 'One-line description' } };
const defaultItems = NAV.map((n) => ({ label: n.label, href: n.href, note: n.note ?? '', children: n.href === '/student-groups' ? [] : (n.children ?? []).map((c) => ({ label: c.label, href: c.href, note: c.note ?? '' })) }));
PLASMIC.registerComponent(SiteHeaderBlock, {
  name: 'SiteHeaderBlock', displayName: 'Site header (editable content)',
  description: "The site's own header: same look, sticky slide-away, drop-down curtains, search and phone menu, with its words and links editable. Menu items edited here replace the shared menu for this header only.",
  props: {
    logoText: { type: 'string', defaultValue: 'LKCMedSoc', displayName: 'Logo text' },
    tagline: { type: 'string', defaultValue: 'Students\u2019 Medical Society', displayName: 'Words beside the logo (wide screens)' },
    menuItems: {
      type: 'array', displayName: 'Menu items',
      description: "Top-level items and the links in each drop-down. Student Groups' list is filled from the database when its sub-items are empty. The apps' shared menu (menu.json) is not changed by edits here.",
      itemType: { type: 'object', nameFunc: (i: { label?: string }) => i?.label, fields: { ...linkFields, children: { type: 'array', displayName: 'Drop-down links', itemType: { type: 'object', nameFunc: (i: { label?: string }) => i?.label, fields: linkFields } } } },
      defaultValue: defaultItems,
    },
    highlights: {
      type: 'array', displayName: 'Highlight cards',
      description: 'A card beside a drop-down. Add one per menu you want it on. There are none by default.',
      itemType: {
        type: 'object', nameFunc: (i: { menu?: string; title?: string }) => `${i?.menu ?? ''}: ${i?.title ?? ''}`,
        fields: {
          menu: { type: 'choice', options: ['student-groups', 'about', 'resources', 'apps'], displayName: 'Show on this menu' },
          eyebrow: { type: 'string', displayName: 'Small label' }, title: { type: 'string' }, body: { type: 'string' },
          linkText: { type: 'string', displayName: 'Link text' }, url: { type: 'string', displayName: 'Link' },
        },
      },
      defaultValue: [],
    },
    ctaText: { type: 'string', defaultValue: 'Apply', displayName: 'Button text' },
    ctaUrl: { type: 'string', defaultValue: 'https://www.ntu.edu.sg/medicine/education/bachelor-of-medicine-and-bachelor-of-surgery-%28mbbs%29', displayName: 'Button link' },
    hideOnScrollDown: { type: 'boolean', defaultValue: true, displayName: 'Slide away when scrolling down', description: 'Slides off when scrolling down past 80px and comes straight back on any scroll up. Never hides inside Studio.' },
    pinned: { type: 'choice', options: ['fixed', 'sticky'], defaultValue: 'fixed', displayName: 'Pinned to', description: 'fixed: the window, so it works anywhere on the page. sticky: only works if its parent box is as tall as the page.' },
    previewOpenMenu: { type: 'choice', options: ['none', 'student-groups', 'about', 'resources', 'apps'], defaultValue: 'none', displayName: 'Show this drop-down open (Studio only)', description: 'Holds a drop-down open on the canvas so you can see it. Has no effect on the live site. The desktop menu shows at 1024px wide or more.' },
  },
  importPath: '@/components/SiteHeaderBlock',
});
PLASMIC.registerComponent(StickyHeader, {
  name: 'StickyHeader', displayName: 'Sticky header bar',
  description: 'A bar that stays at the top, slides away when scrolling down and returns when scrolling up. Put your logo, menu items and buttons inside, and give it a background colour in Studio.',
  props: {
    children: { type: 'slot', displayName: 'Contents' },
    hideOnScrollDown: { type: 'boolean', defaultValue: true, displayName: 'Slide away when scrolling down' },
    pinned: { type: 'choice', options: ['fixed', 'sticky'], defaultValue: 'fixed', displayName: 'Pinned to', description: 'fixed: the window, so it works anywhere on the page. sticky: only works if its parent box is as tall as the page.' },
  },
  importPath: '@/components/blocks/StickyHeader',
});
PLASMIC.registerComponent(HoverMenu, {
  name: 'HoverMenu', displayName: 'Menu item with drop-down',
  description: 'Opens its panel on hover, keyboard focus or tap, with a smooth fade. Design the clickable label in "Label" and the panel in "Panel". Add a "Menu chevron" to the label for an arrow that flips while open.',
  props: {
    trigger: { type: 'slot', displayName: 'Label', defaultValue: { type: 'hbox', styles: { gap: '6px', alignItems: 'center' }, children: [{ type: 'text', value: 'Menu' }, { type: 'component', name: 'MenuChevron' }] } },
    panel: { type: 'slot', displayName: 'Panel', defaultValue: { type: 'vbox', styles: { padding: '8px', background: '#2a0628', borderRadius: '12px', gap: '2px' }, children: [{ type: 'text', value: 'First link' }, { type: 'text', value: 'Second link' }] } },
    align: { type: 'choice', options: ['left', 'right', 'center'], defaultValue: 'left', displayName: 'Panel lines up with the label\'s' },
    panelMinWidth: { type: 'number', defaultValue: 260, displayName: 'Panel minimum width (px)' },
    fullWidth: { type: 'boolean', defaultValue: false, displayName: 'Panel spans the whole header', description: 'Edge to edge across the header bar. Works when the header bar (e.g. the Sticky header bar) is the nearest positioned box.' },
    openInStudio: { type: 'boolean', defaultValue: true, displayName: 'Keep panel open while designing', description: 'Only in Studio, so you can see and edit it. On the live site it opens on hover.' },
  },
  importPath: '@/components/blocks/HoverMenu',
});
PLASMIC.registerComponent(MenuChevron, {
  name: 'MenuChevron', displayName: 'Menu chevron', description: 'A small down arrow that flips while its menu item is open. Put it in the label of a "Menu item with drop-down". It takes the text colour.',
  props: { size: { type: 'number', defaultValue: 16, displayName: 'Size (px)' } }, importPath: '@/components/blocks/HoverMenu',
});
PLASMIC.registerComponent(HoverLift, {
  name: 'HoverLift', displayName: 'Hover lift', description: 'Wrap a card or any block so it rises slightly with the brand shadow when hovered. Links that wrap a card already do this without it.',
  props: { children: 'slot' }, importPath: '@/components/blocks/HoverLift',
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
//  - Create pages at the real paths (/, /events, /gazette, /student-groups, /resources, /about/meet-the-team, /about/houses): when one is
//    published it replaces the coded page; otherwise the coded page shows.
//  - Create Plasmic components named exactly "Header" and "Footer" to replace the site header and footer the same way.
//  - Build them from the blocks below plus Plasmic's own boxes, text and images. The blocks that show live data load it themselves.
// ---------------------------------------------------------------------------------------------------------------------------
import Band from '@/components/blocks/Band';
import SlantPhoto from '@/components/blocks/SlantPhoto';
import PageHero from '@/components/blocks/PageHero';
import HoverLift from '@/components/blocks/HoverLift';
import HoverMenu, { MenuChevron } from '@/components/blocks/HoverMenu';
import StickyHeader from '@/components/blocks/StickyHeader';
import SiteHeaderBlock from '@/components/SiteHeaderBlock';
import { NAV } from '@/lib/nav';
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
  name: 'GroupsBlock', displayName: 'Student groups cards (fixed layout)', description: 'Every CCA as a card, with search and committee filters, in a fixed design. For one you can redesign use "Student groups hub".',
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
// Student groups, in pieces: the hub loads the data and holds the filters; the filters, the list and the card parts go inside it in any layout.
PLASMIC.registerComponent(GroupsHub, {
  name: 'GroupsHub', displayName: 'Student groups hub (start here)',
  description: 'Loads every student group and keeps the filters. It starts with a search box, committee chips and a list of ready cards. For a fully custom design, use Studio\'s own elements with its data ($ctx.groupsHub) and actions.',
  props: {
    limit: { type: 'number', defaultValue: 0, displayName: 'Show at most (0 = all)', description: 'For a small preview, e.g. 3 or 4 on the home page.' },
    pageSize: { type: 'number', defaultValue: 0, displayName: 'Items per page (0 = no pages)', description: 'Turns on paging. Use nextPage, prevPage and goToPage with $ctx page, pageCount, hasNextPage, hasPrevPage and pages. Takes over from "Show at most".' },
    defaultRecruitingOnly: { type: 'boolean', defaultValue: false, displayName: 'Start with recruiting groups only', hidden: () => true }, // the site no longer uses a recruiting idea; kept so older designs still load
    defaultCommittee: { type: 'string', displayName: 'Start with this committee', description: 'A committee name or slug, e.g. careers. Leave empty for all.' },
    order: { type: 'choice', options: ['a-z', 'random'], defaultValue: 'a-z', displayName: 'Order', description: 'Random gives a different mix on each visit.' },
    children: {
      type: 'slot', displayName: 'Contents',
      defaultValue: {
        type: 'vbox', styles: { gap: '16px' },
        children: [
          { type: 'hbox', styles: { gap: '8px', alignItems: 'center', flexWrap: 'wrap' }, children: [
            { type: 'component', name: 'GroupsSearch' }, { type: 'component', name: 'GroupsClear' },
          ] },
          { type: 'component', name: 'GroupsCommitteeChips' },
          { type: 'component', name: 'GroupsCount' },
          { type: 'component', name: 'GroupsList', props: { columns: 3, byCommittee: true, children: {
            type: 'component', name: 'GroupLink', props: { children: {
              type: 'vbox', styles: { gap: '10px', padding: '12px', background: '#ffffff', borderRadius: '12px' },
              children: [
                { type: 'component', name: 'GroupImage', props: { source: 'header', shape: 'rounded', ratio: '16/9' } },
                { type: 'component', name: 'GroupBadge', props: { look: 'pill' } },
                { type: 'component', name: 'GroupText', props: { field: 'name' } },
                { type: 'component', name: 'GroupText', props: { field: 'description', clamp: 2 } },
                { type: 'component', name: 'GroupText', props: { field: 'chair', prefix: 'Chairperson · ' } },
              ],
            } },
          } } },
        ],
      },
    },
  },
  providesData: true,
  // Actions Studio elements can run (Interactions > Run component action): a search box calls setSearch, a chip calls toggleCommittee, etc.
  refActions: {
    setSearch: { description: 'Set the search words', argTypes: [{ name: 'query', type: 'string' }] },
    toggleCommittee: { description: 'Turn a committee filter on or off (use the committee slug)', argTypes: [{ name: 'slug', type: 'string' }] },
    setRecruitingOnly: { description: 'Show only recruiting groups (true) or all (false)', argTypes: [{ name: 'on', type: 'boolean' }] },
    toggleRecruitingOnly: { description: 'Flip the recruiting-only filter', argTypes: [] },
    nextPage: { description: 'Go to the next page', argTypes: [] },
    prevPage: { description: 'Go to the previous page', argTypes: [] },
    goToPage: { description: 'Go to a page number (1 is the first)', argTypes: [{ name: 'page', type: 'number' }] },
    clearFilters: { description: 'Reset the search and every filter', argTypes: [] },
  },
  importPath: '@/components/groups/GroupsHub',
});
PLASMIC.registerComponent(GroupsList, {
  name: 'GroupsList', displayName: 'Groups list (repeats your card)',
  description: 'Repeats the card you design inside it once per group that matches the filters. Goes inside a Student groups hub.',
  props: {
    columns: { type: 'number', defaultValue: 3, displayName: 'Columns' },
    gap: { type: 'number', defaultValue: 16, displayName: 'Space between cards (px)' },
    byCommittee: { type: 'boolean', defaultValue: true, displayName: 'A heading for each committee' },
    children: { type: 'slot', displayName: 'The card' },
  },
  providesData: true, importPath: '@/components/groups/GroupsList',
});
PLASMIC.registerComponent(GroupsSearch, {
  name: 'GroupsSearch', displayName: 'Groups: search box', description: 'Search the groups by name or description. Goes inside a Student groups hub.',
  props: { placeholder: { type: 'string', defaultValue: 'Search groups' } }, importPath: '@/components/groups/GroupsFilters',
});
PLASMIC.registerComponent(GroupsCommitteeChips, {
  name: 'GroupsCommitteeChips', displayName: 'Groups: committee filter chips', description: 'One chip per committee; pick several. Goes inside a Student groups hub.',
  props: { showDots: { type: 'boolean', defaultValue: true, displayName: 'Show the colour dots' } }, importPath: '@/components/groups/GroupsFilters',
});
PLASMIC.registerComponent(GroupsRecruitingToggle, {
  name: 'GroupsRecruitingToggle', displayName: 'Groups: recruiting filter', description: 'Not used any more: the site has no recruiting idea. Kept so older designs still load.',
  props: { label: { type: 'string', defaultValue: 'Recruiting' } }, importPath: '@/components/groups/GroupsFilters',
});
PLASMIC.registerComponent(GroupsClear, {
  name: 'GroupsClear', displayName: 'Groups: clear filters', description: 'A link that resets the filters. Appears only when a filter is on.',
  props: { label: { type: 'string', defaultValue: 'Clear' } }, importPath: '@/components/groups/GroupsFilters',
});
PLASMIC.registerComponent(GroupsCount, {
  name: 'GroupsCount', displayName: 'Groups: result count', description: 'Says how many groups are showing.', props: {}, importPath: '@/components/groups/GroupsFilters',
});
PLASMIC.registerComponent(GroupText, {
  name: 'GroupText', displayName: 'Group: text', description: "A piece of the group's details, already connected. Style it like any text.",
  props: {
    field: { type: 'choice', options: ['name', 'committeeShort', 'committee', 'description', 'chair'], defaultValue: 'name', displayName: 'Show' },
    prefix: { type: 'string', displayName: 'Words before it' },
    clamp: { type: 'number', defaultValue: 0, displayName: 'Cut off after this many lines (0 = never)' },
  },
  importPath: '@/components/groups/GroupParts',
});
PLASMIC.registerComponent(GroupImage, {
  name: 'GroupImage', displayName: 'Group: picture', description: "The group's header picture or logo, already connected, in the shape you pick. Shows the committee colour with initials when there is none.",
  props: {
    source: { type: 'choice', options: ['header', 'logo'], defaultValue: 'header', displayName: 'Picture' },
    shape: { type: 'choice', options: ['rounded', 'square', 'round'], defaultValue: 'rounded', displayName: 'Shape' },
    ratio: { type: 'choice', options: ['16/9', '4/3', '1/1', '4/5'], defaultValue: '16/9', displayName: 'Proportions (not for round)' },
    hideIfMissing: { type: 'boolean', defaultValue: false, displayName: 'Hide when there is no picture' },
  },
  importPath: '@/components/groups/GroupParts',
});
PLASMIC.registerComponent(GroupBadge, {
  name: 'GroupBadge', displayName: 'Group: committee tag', description: "The group's committee on its own colour. A pill, a full-width bar, or just a coloured dot.",
  props: { look: { type: 'choice', options: ['pill', 'bar', 'dot'], defaultValue: 'pill', displayName: 'Look' } }, importPath: '@/components/groups/GroupParts',
});
PLASMIC.registerComponent(GroupRecruiting, {
  name: 'GroupRecruiting', displayName: 'Group: recruiting tag', description: 'Not used any more: the site has no recruiting idea. Kept so older designs still load.',
  props: { label: { type: 'string', defaultValue: 'Recruiting' } }, importPath: '@/components/groups/GroupParts',
});
PLASMIC.registerComponent(GroupLink, {
  name: 'GroupLink', displayName: 'Group: link wrapper', description: "Wrap the whole card in this to link to the group's page.",
  props: { children: 'slot' }, importPath: '@/components/groups/GroupParts',
});

// Headless controllers for events, news and the team: they give Studio data and actions, and draw nothing themselves.
const hubSlot = (what: string) => ({ type: 'slot' as const, displayName: 'Contents', defaultValue: { type: 'text' as const, value: `Design your layout here with Studio's own elements, using ${what}.` } });
PLASMIC.registerComponent(EventsHub, {
  name: 'EventsHub', displayName: 'Events hub (data and filters)',
  description: 'Loads the upcoming events and keeps the filters. Draws nothing: use Studio elements with $ctx.eventsHub and its actions.',
  props: {
    children: hubSlot('$ctx.eventsHub'),
    limit: { type: 'number', defaultValue: 0, displayName: 'Show at most (0 = all)', description: 'For a small preview, e.g. 3 on the home page.' },
    pageSize: { type: 'number', defaultValue: 0, displayName: 'Items per page (0 = no pages)', description: 'Turns on paging. Use nextPage, prevPage and goToPage with $ctx page, pageCount, hasNextPage, hasPrevPage and pages. Takes over from "Show at most".' },
    defaultRsvpOnly: { type: 'boolean', defaultValue: false, displayName: 'Start with RSVP-open events only' },
    defaultCommittee: { type: 'string', displayName: 'Start with this committee', description: 'A committee name. Leave empty for all.' },
  },
  providesData: true,
  refActions: {
    setSearch: { description: 'Set the search words', argTypes: [{ name: 'query', type: 'string' }] },
    setCommittee: { description: 'Show one committee (empty text = all)', argTypes: [{ name: 'name', type: 'string' }] },
    toggleCommittee: { description: 'Pick a committee, or unpick it if already picked', argTypes: [{ name: 'name', type: 'string' }] },
    setMonth: { description: 'Show one month (key like 2026-11; empty text = all)', argTypes: [{ name: 'key', type: 'string' }] },
    toggleMonth: { description: 'Pick a month, or unpick it if already picked', argTypes: [{ name: 'key', type: 'string' }] },
    setRsvpOnly: { description: 'Show only events open for RSVP', argTypes: [{ name: 'on', type: 'boolean' }] },
    toggleRsvpOnly: { description: 'Flip the RSVP-open filter', argTypes: [] },
    setOpenToEveryone: { description: 'Hide NTU-students-only events', argTypes: [{ name: 'on', type: 'boolean' }] },
    toggleOpenToEveryone: { description: 'Flip the open-to-everyone filter', argTypes: [] },
    nextPage: { description: 'Go to the next page', argTypes: [] },
    prevPage: { description: 'Go to the previous page', argTypes: [] },
    goToPage: { description: 'Go to a page number (1 is the first)', argTypes: [{ name: 'page', type: 'number' }] },
    clearFilters: { description: 'Reset the search and every filter', argTypes: [] },
  },
  importPath: '@/components/hubs/EventsHub',
});
PLASMIC.registerComponent(NewsHub, {
  name: 'NewsHub', displayName: 'News hub (data and filters)',
  description: 'Loads the latest stories and keeps the filters. Draws nothing: use Studio elements with $ctx.newsHub and its actions.',
  props: {
    children: hubSlot('$ctx.newsHub'),
    limit: { type: 'number', defaultValue: 12, displayName: 'Show at most (0 = all)', description: 'For a small preview, e.g. 3 on the home page.' },
    pageSize: { type: 'number', defaultValue: 0, displayName: 'Items per page (0 = no pages)', description: 'Turns on paging. Use nextPage, prevPage and goToPage with $ctx page, pageCount, hasNextPage, hasPrevPage and pages. Takes over from "Show at most".' },
    defaultCategory: { type: 'string', defaultValue: '', helpText: 'A category name exactly as it appears in the Gazette, or several separated by commas.', displayName: 'Start with this category' },
    defaultCommittee: { type: 'string', displayName: 'Start with this committee', description: 'A committee name. Leave empty for all.' },
  },
  providesData: true,
  refActions: {
    setSearch: { description: 'Set the search words', argTypes: [{ name: 'query', type: 'string' }] },
    setCategory: { description: 'Show one category (empty text = all)', argTypes: [{ name: 'name', type: 'string' }] },
    toggleCategory: { description: 'Pick a category, or unpick it if already picked', argTypes: [{ name: 'name', type: 'string' }] },
    setCommittee: { description: 'Show one committee (empty text = all)', argTypes: [{ name: 'name', type: 'string' }] },
    toggleCommittee: { description: 'Pick a committee, or unpick it if already picked', argTypes: [{ name: 'name', type: 'string' }] },
    nextPage: { description: 'Go to the next page', argTypes: [] },
    prevPage: { description: 'Go to the previous page', argTypes: [] },
    goToPage: { description: 'Go to a page number (1 is the first)', argTypes: [{ name: 'page', type: 'number' }] },
    clearFilters: { description: 'Reset the search and every filter', argTypes: [] },
  },
  importPath: '@/components/hubs/NewsHub',
});
PLASMIC.registerComponent(PolicyHub, {
  name: 'PolicyHub', displayName: 'Policy hub (documents and search)',
  description: 'Loads the published policy documents, grouped by tier, plus search. Draws nothing: use Studio elements with $ctx.policyHub and its actions.',
  props: { children: hubSlot('$ctx.policyHub') },
  providesData: true,
  refActions: {
    setSearch: { description: 'Search the policy text, or type a provision number such as B-9.4', argTypes: [{ name: 'query', type: 'string' }] },
    clearSearch: { description: 'Clear the search', argTypes: [] },
  },
  importPath: '@/components/hubs/PolicyHub',
});
PLASMIC.registerComponent(PolicyDocHub, {
  name: 'PolicyDocHub', displayName: 'Policy document hub (one document)',
  description: 'Loads one policy document with its provisions, versions, recent changes and the previous and next document. Draws nothing: use Studio elements with $ctx.policyDoc.',
  props: {
    children: hubSlot('$ctx.policyDoc'),
    slug: { type: 'string', displayName: 'Document address', helpText: 'On a page at /policy/[slug], set this to $ctx.params.slug. Leave empty while designing: the first document is shown as a preview.' },
  },
  providesData: true,
  importPath: '@/components/hubs/PolicyDocHub',
});
// Editing a policy document where it is read (ExCo only; readers never see any of these). Place them in the document design; see DATA-CHEATSHEET.md, "Policy editing".
PLASMIC.registerComponent(PolicyEditRoot, {
  name: 'PolicyEditRoot', displayName: 'Policy editing: wrap the document',
  description: 'Put this around the whole document design, inside the Policy document hub. It switches editing on for ExCo and gives $ctx.policyEdit (isExco, mode, isEditing, canEdit, openProposalCount). Draws nothing for readers.',
  props: { children: { type: 'slot' as const, displayName: 'Document design' } },
  providesData: true,
  importPath: '@/components/policy/PolicyEditParts',
  importName: 'PolicyEditRoot',
});
PLASMIC.registerComponent(PolicyModeSwitch, {
  name: 'PolicyModeSwitch', displayName: 'Policy editing: mode switch',
  description: 'The Viewing / Editing (or Suggesting) switch. Only ExCo see it. Put it in the top bar, inside "Policy editing: wrap the document".',
  props: {},
  importPath: '@/components/policy/PolicyEditParts',
  importName: 'PolicyModeSwitch',
});
PLASMIC.registerComponent(PolicyProposals, {
  name: 'PolicyProposals', displayName: 'Policy editing: proposals banner',
  description: 'Proposals about the whole document (such as adopting a draft) with their votes, and the "Propose adopting" button. Only ExCo see it. Put it above the first provision.',
  props: {},
  importPath: '@/components/policy/PolicyEditParts',
  importName: 'PolicyProposals',
});
PLASMIC.registerComponent(PolicyAddProvision, {
  name: 'PolicyAddProvision', displayName: 'Policy editing: add a provision',
  description: 'The "Add a provision" button and form. Only ExCo see it, and only in Editing or Suggesting. Put it after the last provision.',
  props: {},
  importPath: '@/components/policy/PolicyEditParts',
  importName: 'PolicyAddProvision',
});
PLASMIC.registerComponent(PolicyEditable, {
  name: 'PolicyEditable', displayName: 'Policy editing: one provision',
  description: 'Put the elements of ONE provision inside this (inside the repeat over $ctx.policyDoc.provisions). Readers see them as designed. In Editing or Suggesting, ExCo get an Edit button, and the editor replaces them. Pending proposals show underneath.',
  props: {
    refId: { type: 'string', displayName: 'Provision number', helpText: 'Bind to currentProvision.ref (for example "B-9.4").' },
    children: { type: 'slot' as const, displayName: 'The provision as readers see it' },
  },
  importPath: '@/components/policy/PolicyEditParts',
  importName: 'PolicyEditable',
});
PLASMIC.registerComponent(PolicyProvisionText, {
  name: 'PolicyProvisionText', displayName: 'Policy provision text',
  description: 'Shows one provision\'s text with its lists and tables already styled. Set "HTML" to currentProvision.html.',
  props: { html: { type: 'string', displayName: 'HTML', helpText: 'Bind to currentProvision.html.' } },
  importPath: '@/components/policy/PolicyEditParts',
  importName: 'PolicyProvisionText',
});
PLASMIC.registerComponent(PolicyExcoDocuments, {
  name: 'PolicyExcoDocuments', displayName: 'Policy editing: all documents (ExCo)',
  description: 'For the contents page: every document, published or not, with a "Shown on the website" tick. Only ExCo see it.',
  props: {},
  importPath: '@/components/policy/PolicyEditParts',
  importName: 'PolicyExcoDocuments',
});
PLASMIC.registerComponent(PeopleHub, {
  name: 'PeopleHub', displayName: 'People hub (data and search)',
  description: 'Loads the team (ExCo, committee heads, year and stream reps). Draws nothing: use Studio elements with $ctx.peopleHub.',
  props: {
    children: hubSlot('$ctx.peopleHub'),
    limit: { type: 'number', defaultValue: 0, displayName: 'Show at most (0 = all)', description: 'Applies to each flat list (exco, committeeHeads, yearReps, streamReps).' },
  },
  providesData: true,
  refActions: {
    setSearch: { description: 'Search people by name, title or group', argTypes: [{ name: 'query', type: 'string' }] },
    clearFilters: { description: 'Clear the search', argTypes: [] },
  },
  importPath: '@/components/hubs/PeopleHub',
});

PLASMIC.registerComponent(PersonText, {
  name: 'PersonText', displayName: 'Person: text', description: "A piece of the person's details, already connected. Pick name, title, group or initials. Style it like any text.",
  props: { field: { type: 'choice', options: ['name', 'title', 'group', 'initials'], defaultValue: 'name', displayName: 'Show' } },
  importPath: '@/components/PersonParts',
});
PLASMIC.registerComponent(PersonPhoto, {
  name: 'PersonPhoto', displayName: 'Person: photo', description: "The person's photo, already connected, in the shape you pick. Shows initials if they have not shared one.",
  props: {
    shape: { type: 'choice', options: ['square', 'rounded', 'round'], defaultValue: 'square', displayName: 'Shape' },
    ratio: { type: 'choice', options: ['1/1', '4/5', '3/4', '16/9'], defaultValue: '1/1', displayName: 'Proportions (not for round)' },
  },
  importPath: '@/components/PersonParts',
});
PLASMIC.registerComponent(PersonLink, {
  name: 'PersonLink', displayName: 'Person: link wrapper', description: "Wrap the whole card in this to link to the person's committee page.",
  props: { children: 'slot' }, importPath: '@/components/PersonParts',
});
PLASMIC.registerComponent(PeopleList, {
  name: 'PeopleList', displayName: 'People list (design your own card)',
  description: 'Loads real people and repeats the card you design inside it, once per person. It starts with a ready card already connected to each person; change its layout, shape and styling freely, or add more Person pieces (text, photo, link).',
  props: {
    part: { type: 'choice', options: ['exco', 'committee-heads', 'year-reps', 'stream-reps'], defaultValue: 'exco', displayName: 'Who' },
    columns: { type: 'number', defaultValue: 3, displayName: 'Columns' },
    gap: { type: 'number', defaultValue: 16, displayName: 'Space between cards (px)' },
    children: {
      type: 'slot', displayName: 'The card',
      defaultValue: {
        type: 'component', name: 'PersonLink',
        props: {
          children: {
            type: 'vbox', styles: { gap: '8px', padding: '16px', background: '#ffffff', borderRadius: '12px' },
            children: [
              { type: 'component', name: 'PersonPhoto', props: { shape: 'square' } },
              { type: 'component', name: 'PersonText', props: { field: 'name' } },
              { type: 'component', name: 'PersonText', props: { field: 'title' } },
            ],
          },
        },
      },
    },
  },
  providesData: true,
  importPath: '@/components/PeopleList',
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
