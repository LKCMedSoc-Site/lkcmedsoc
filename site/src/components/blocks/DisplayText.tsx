// Text in the brand's big condensed face (DIN Engschrift, capitals, tight spacing). Pick a size and a colour.
const SIZES = { hero: 'hero-title', xl: 'h-xl', lg: 'display text-5xl md:text-6xl', md: 'display text-3xl md:text-4xl', sm: 'display text-2xl' } as const;
const TONES = { dark: 'text-p950', plum: 'text-p900', white: 'text-white', pink: 'text-pink', orchid: 'text-p300', magenta: 'text-p500', mist: 'text-mist' } as const;

export default function DisplayText({ text = 'Heading', size = 'xl', tone = 'plum', as = 'h2', className = '' }: {
  text?: string; size?: keyof typeof SIZES; tone?: keyof typeof TONES; as?: 'h1' | 'h2' | 'h3' | 'p'; className?: string;
}) {
  const Tag = as;
  return <Tag className={`${SIZES[size] ?? SIZES.xl} ${TONES[tone] ?? TONES.plum} ${className}`}>{text}</Tag>;
}
