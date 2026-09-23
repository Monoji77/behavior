import { type ReactNode, useEffect, useRef } from "react";
import { motion } from "motion/react";

// Adapted from Aceternity UI's Navbar Menu (ui.aceternity.com/components/navbar-menu):
// the same spring panel and shared-layout ("active") animation, but the trigger is
// supplied by the caller and also opens on click/tap/keyboard, the panel holds any
// content, and the menu closes on Escape or a click outside.

const transition = {
  type: "spring" as const,
  mass: 0.5,
  damping: 11.5,
  stiffness: 100,
  restDelta: 0.001,
  restSpeed: 0.001,
};

export const MenuItem = ({
  setActive,
  active,
  item,
  trigger,
  children,
}: {
  setActive: (item: string | null) => void;
  active: string | null;
  item: string;
  trigger: ReactNode;
  children?: ReactNode;
}) => {
  return (
    <div onMouseEnter={() => setActive(item)} className="relative">
      {trigger}
      {active !== null && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={transition}
        >
          {active === item && (
            <div className="absolute top-full left-0 z-20 pt-2">
              <motion.div
                transition={transition}
                layoutId="active" // layoutId ensures smooth animation between items
                className="menu-panel"
              >
                <motion.div layout className="h-full w-max">
                  {children}
                </motion.div>
              </motion.div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export const Menu = ({
  setActive,
  className,
  children,
}: {
  setActive: (item: string | null) => void;
  className?: string;
  children: ReactNode;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setActive(null);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [setActive]);
  return (
    <div
      ref={ref}
      role="group"
      onMouseLeave={() => {
        // Don't discard a search the user is typing just because the pointer drifted off.
        const focused = document.activeElement;
        if (focused instanceof HTMLInputElement && ref.current?.contains(focused) && focused.value) return;
        setActive(null);
      }}
      onKeyDown={(event) => { if (event.key === "Escape") setActive(null); }}
      className={className}
    >
      {children}
    </div>
  );
};
