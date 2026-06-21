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
  <div className="min-h-14 md:h-14 py-3 md:py-0 px-4 md:px-6 bg-app-surface border-b border-app-border flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-0 shrink-0 z-10">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg bg-pld-blue/10 shrink-0 ${accentColor}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <h2 className="font-bold text-xs md:text-sm uppercase tracking-wide text-app-text flex flex-wrap items-center gap-1.5 leading-snug">
          {title}
          {badge}
        </h2>
        {subtitle && (
          <p className="text-[10px] md:text-[11px] text-app-muted font-medium mt-0.5 break-words md:whitespace-normal">{subtitle}</p>
        )}
      </div>
    </div>
    {actions && (
      <div className="flex items-center gap-1.5 md:gap-2 flex-wrap md:flex-nowrap w-full md:w-auto overflow-x-auto md:overflow-visible pb-1 md:pb-0 custom-scrollbar">
        {actions}
      </div>
    )}
  </div>
);

export default PageHeader;
