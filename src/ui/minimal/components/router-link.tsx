import type { ComponentProps } from "react";

import Link from "next/link";

// ----------------------------------------------------------------------
// Ported from minimal-ui-kit/material-kit-react (MIT) — see ../LICENSE.md
// Original used the router library's `Link` component as `to`; replaced
// with next/link.
// ----------------------------------------------------------------------

type NextLinkProps = ComponentProps<typeof Link>;

interface RouterLinkProps extends Omit<NextLinkProps, "href"> {
  href: NextLinkProps["href"];
  ref?: React.RefObject<HTMLAnchorElement | null>;
}

export function RouterLink({ href, ref, ...other }: RouterLinkProps) {
  return <Link ref={ref} href={href} {...other} />;
}
