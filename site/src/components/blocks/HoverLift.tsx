// Wrap any card or block to give it the brand hover lift (rises 2px with the brand shadow). Pure CSS, see .lift in globals.css.
export default function HoverLift({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <div className={`lift ${className}`}>{children}</div>;
}
