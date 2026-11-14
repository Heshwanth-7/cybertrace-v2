import { useRef, useState, type MouseEvent } from "react";

import { getLenis } from "../../lib/lenis";
import { Button } from "../ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "../ui/dialog";
import { MagneticButton } from "../ui/MagneticButton";

const links = [
  { href: "#how", label: "How it works" },
  { href: "#studio", label: "Studio" },
  { href: "#gallery", label: "Gallery" },
];

function scrollToSection(event: MouseEvent<HTMLAnchorElement>, onNavigate?: () => void) {
  if (event.defaultPrevented || event.button !== 0 ||
    event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  onNavigate?.();
  const lenis = getLenis();
  const hash = event.currentTarget.hash;
  if (!lenis || !document.getElementById(hash.slice(1))) return;

  event.preventDefault();
  if (window.location.hash !== hash) window.history.pushState(null, "", hash);
  lenis.scrollTo(hash);
}

export function Nav({ ready }: { ready: boolean }) {
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      inert={!ready}
      className={"fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-4 px-[clamp(1rem,5vw,5rem)] py-3 text-ink mix-blend-difference transition-opacity duration-500 md:py-5 " + (ready ? "opacity-100" : "opacity-0")}
    >
      <a href="#hero" onClick={(event) => scrollToSection(event)} className="inline-flex min-h-11 items-center font-mono text-lg tracking-[0.12em]">
        CYBERTRACE
      </a>

      <nav aria-label="Main navigation" className="hidden gap-x-5 text-sm md:flex lg:gap-x-8">
        {links.map(({ href, label }) => (
          <a key={href} href={href} onClick={(event) => scrollToSection(event)} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
            {label}
          </a>
        ))}
      </nav>
      <div className="hidden md:block">
        <MagneticButton asChild className="h-11 rounded-full border-neon bg-transparent px-6 text-neon hover:bg-neon hover:text-void">
          <a href="#studio" onClick={(event) => scrollToSection(event)}>Launch Studio</a>
        </MagneticButton>
      </div>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogTrigger asChild>
          <Button ref={menuTrigger} type="button" variant="ghost" className="min-h-11 min-w-11 md:hidden">Menu</Button>
        </DialogTrigger>
        <DialogContent aria-describedby={undefined} showCloseButton={false} onCloseAutoFocus={(event) => {
          event.preventDefault();
          menuTrigger.current?.focus({ preventScroll: true });
        }}>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle>Menu</DialogTitle>
            <DialogClose asChild>
              <Button type="button" variant="ghost" className="min-h-11 min-w-11">Close</Button>
            </DialogClose>
          </div>
          <nav aria-label="Mobile navigation" className="grid gap-1">
            {links.map(({ href, label }) => (
              <a key={href} href={href} onClick={(event) => scrollToSection(event, () => setMenuOpen(false))} className="flex min-h-11 items-center rounded-md px-3 hover:bg-ink/10">
                {label}
              </a>
            ))}
          </nav>
        </DialogContent>
      </Dialog>
    </header>
  );
}
