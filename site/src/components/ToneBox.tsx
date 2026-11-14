import type { CSSProperties, ReactNode } from 'react';

export type ToneBoxProps = {
  children?: ReactNode; className?: string;
  /** A colour from the data (an event's or committee's `color`). Empty = the brand plum. */
  color?: string;
  /** solid: filled, white text. tint: 12% wash, coloured text. text: coloured text only. outline: coloured border and text. */
  look?: 'solid' | 'tint' | 'text' | 'outline';
  as?: 'div' | 'span';
};

const wash = (hex: string, a: number) => (/^#[0-9a-f]{6}$/i.test(hex) ? hex + Math.round(a * 255).toString(16).padStart(2, '0') : hex);

/** A box that takes its colour from a prop, so Studio can colour a piece from the data (committee colours) without a style override. */
export default function ToneBox({ children, className = '', color = '', look = 'tint', as = 'div' }: ToneBoxProps) {
  const c = color || '#4d0a49';
  const style: CSSProperties =
    look === 'solid' ? { backgroundColor: c, color: '#ffffff' }
    : look === 'tint' ? { backgroundColor: wash(c, 0.12), color: c }
    : look === 'outline' ? { borderColor: c, color: c, borderStyle: 'solid', borderWidth: 1 }
    : { color: c };
  const Tag = as;
  return <Tag className={className} style={style}>{children}</Tag>;
}
