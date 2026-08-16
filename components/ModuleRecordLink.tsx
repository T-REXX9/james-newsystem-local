import React from 'react';

interface ModuleRecordLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'> {
  tab: string;
  payload?: Record<string, string | undefined>;
  onOpen?: () => void;
}

export const buildModuleRecordHref = (tab: string, payload: Record<string, string | undefined> = {}) => {
  const params = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return `#/${tab}${query ? `?${query}` : ''}`;
};

const ModuleRecordLink: React.FC<ModuleRecordLinkProps> = ({ tab, payload, onOpen, children, ...props }) => (
  <a
    {...props}
    href={buildModuleRecordHref(tab, payload)}
    onClick={(event) => {
      event.stopPropagation();
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (onOpen) {
        onOpen();
        return;
      }
      window.dispatchEvent(new CustomEvent('workflow:navigate', {
        detail: { tab, payload },
      }));
    }}
  >
    {children}
  </a>
);

export default ModuleRecordLink;
