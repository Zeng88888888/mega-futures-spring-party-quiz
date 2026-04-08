import type { PropsWithChildren, ReactNode } from "react";

interface SectionCardProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  aside?: ReactNode;
}

export function SectionCard({
  title,
  subtitle,
  aside,
  children
}: SectionCardProps) {
  return (
    <section className="section-card">
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}
