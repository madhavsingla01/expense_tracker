import React, { useState } from 'react';
import { User } from 'lucide-react';
import { getInitials, resolveMediaUrl } from '../../utils/media';

const sizes = {
  xs: 'h-7 w-7 text-[10px] rounded-lg',
  sm: 'h-9 w-9 text-xs rounded-xl',
  md: 'h-11 w-11 text-sm rounded-xl',
  lg: 'h-16 w-16 text-xl rounded-2xl',
  xl: 'h-20 w-20 text-2xl rounded-2xl',
};

export default function Avatar({ src, name, email, size = 'md', className = '' }) {
  const [failed, setFailed] = useState(false);
  const sizeClass = sizes[size] || sizes.md;
  const label = name || email || 'User';
  const imageUrl = src && !failed ? resolveMediaUrl(src) : '';

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={label}
        onError={() => setFailed(true)}
        className={`${sizeClass} shrink-0 object-cover border border-zinc-700/70 bg-zinc-900 ${className}`}
      />
    );
  }

  return (
    <span
      className={`${sizeClass} shrink-0 inline-flex items-center justify-center border border-indigo-400/25 bg-gradient-to-br from-indigo-500 to-emerald-500 font-bold text-white shadow-lg shadow-indigo-500/10 ${className}`}
      aria-label={label}
      title={label}
    >
      {label ? getInitials(label) : <User size={16} />}
    </span>
  );
}
