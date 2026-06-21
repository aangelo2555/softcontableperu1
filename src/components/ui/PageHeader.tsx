import React from 'react';

interface PageHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  accentColor?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  icon,
  title,
  subtitle,
  badge,
  actions,
  accentColor = 'text-pld-blue',
}) => (
  <div className="h-14 px-6 bg-app-surface border-b border-app-border flex items-center justify-between shrink-0 z-10">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg bg-pld-blue/10 ${accentColor}`}>
        {icon}
      </div>
      <div>
        <h2 className="font-bold text-sm uppercase tracking-wide text-app-text flex items-center gap-2">
          {title}
          {badge}
        </h2>
        {subtitle && (
          <p className="text-[11px] text-app-muted font-medium">{subtitle}</p>
        )}
      </div>
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);

export default PageHeader;
