import type { ReactElement } from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

// Hover/focus preview card for an external link: a screenshot of the page, its title and address.
export function LinkPreview({ image, title, address, children }: { image: string; title: string; address: string; children: ReactElement }) {
  return <TooltipPrimitive.Root>
    <TooltipPrimitive.Trigger render={children} />
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner side="right" sideOffset={14} align="end" className="z-50">
        <TooltipPrimitive.Popup className="link-preview">
          <img src={image} alt="" width={280} height={175} loading="lazy" />
          <span className="link-preview__text"><strong>{title}</strong><small>{address}</small></span>
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  </TooltipPrimitive.Root>;
}
