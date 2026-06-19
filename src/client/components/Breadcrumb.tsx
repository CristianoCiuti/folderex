import type { Breadcrumb } from "../types";

interface BreadcrumbNavProps {
  breadcrumbs: Breadcrumb[];
  onNavigate: (path: string) => void;
}

export function BreadcrumbNav({ breadcrumbs, onNavigate }: BreadcrumbNavProps) {
  return (
    <nav class="breadcrumbs">
      {breadcrumbs.map((b, i) => {
        const isLast = i === breadcrumbs.length - 1;
        return (
          <>
            {i > 0 && <span class="sep">/</span>}
            {isLast ? (
              <span class="crumb current">{b.name}</span>
            ) : (
              <a
                href={b.path}
                class="crumb"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(b.path);
                }}
              >
                {b.name}
              </a>
            )}
          </>
        );
      })}
    </nav>
  );
}
