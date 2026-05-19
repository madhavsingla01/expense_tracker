import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const ContextMenuContext = createContext(null);

export function ContextMenuProvider({ children }) {
  const [menuConfig, setMenuConfig] = useState(null);
  const menuRef = useRef(null);

  const closeMenu = useCallback(() => setMenuConfig(null), []);

  const openMenu = useCallback((e, items) => {
    e.preventDefault();
    e.stopPropagation();

    // Calculate position
    const x = e.clientX || (e.touches && e.touches[0].clientX);
    const y = e.clientY || (e.touches && e.touches[0].clientY);

    // Prevent off-screen rendering
    // Assuming max menu width 240px and max height 300px
    const maxX = window.innerWidth - 240;
    const maxY = window.innerHeight - 300;

    setMenuConfig({
      x: Math.min(x, maxX),
      y: Math.min(y, maxY),
      items: items.filter(Boolean), // remove nulls
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuConfig && menuRef.current && !menuRef.current.contains(e.target)) {
        closeMenu();
      }
    };
    
    // Also close on escape or scroll
    const handleKeydown = (e) => { if (e.key === 'Escape') closeMenu(); };
    const handleScroll = () => { if (menuConfig) closeMenu(); };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeydown);
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [menuConfig, closeMenu]);

  return (
    <ContextMenuContext.Provider value={{ openMenu, closeMenu }}>
      {children}
      {menuConfig && (
        <div 
          className="fixed inset-0 z-50 pointer-events-none" 
          onContextMenu={(e) => { e.preventDefault(); closeMenu(); }}
        >
          <div 
            ref={menuRef}
            style={{ top: menuConfig.y, left: menuConfig.x }}
            className="absolute pointer-events-auto min-w-[180px] py-1.5 bg-[#1a1a1e]/95 backdrop-blur-xl border border-zinc-800 rounded-xl shadow-2xl animate-[scaleIn_0.1s_ease-out] origin-top-left overflow-hidden"
          >
            {menuConfig.items.map((item, index) => {
              if (item.divider) return <div key={index} className="my-1 border-t border-zinc-800/60" />;
              
              const Icon = item.icon;
              return (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    item.onClick();
                    closeMenu();
                  }}
                  className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-3 transition-colors ${
                    item.danger 
                      ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300' 
                      : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  {Icon && <Icon size={14} className={item.danger ? 'text-red-500' : 'text-zinc-400'} />}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </ContextMenuContext.Provider>
  );
}

export function useContextMenu() {
  const context = useContext(ContextMenuContext);
  if (!context) throw new Error('useContextMenu must be used within ContextMenuProvider');
  
  // Helper for element attachment to handle both right click and long press
  const bindContextMenu = useCallback((items) => {
    let timer;
    let isTouch = false;

    const handleContextMenu = (e) => {
      if (!isTouch) {
        context.openMenu(e, items);
      }
    };

    const handleTouchStart = (e) => {
      isTouch = true;
      timer = setTimeout(() => {
        context.openMenu(e, items);
      }, 600); // 600ms long press
    };

    const handleTouchEnd = () => {
      clearTimeout(timer);
    };

    return {
      onContextMenu: handleContextMenu,
      onTouchStart: handleTouchStart,
      onTouchEnd: handleTouchEnd,
      onTouchMove: handleTouchEnd,
    };
  }, [context]);

  return { ...context, bindContextMenu };
}
