import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { createPortal } from 'react-dom';

const PRESETS = [
  { label: 'Today', getValue: () => { const d = new Date(); const s = d.toISOString().split('T')[0]; return { start: s, end: s }; } },
  { label: 'Last 7 Days', getValue: () => { const d = new Date(); const end = d.toISOString().split('T')[0]; d.setDate(d.getDate() - 7); const start = d.toISOString().split('T')[0]; return { start, end }; } },
  { label: 'Last 30 Days', getValue: () => { const d = new Date(); const end = d.toISOString().split('T')[0]; d.setDate(d.getDate() - 30); const start = d.toISOString().split('T')[0]; return { start, end }; } },
  { label: 'This Month', getValue: () => { const d = new Date(); const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]; const end = d.toISOString().split('T')[0]; return { start, end }; } },
  { label: 'Last Month', getValue: () => { const d = new Date(); const start = new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split('T')[0]; const end = new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split('T')[0]; return { start, end }; } },
  { label: 'Last 3 Months', getValue: () => { const d = new Date(); const end = d.toISOString().split('T')[0]; d.setMonth(d.getMonth() - 3); const start = d.toISOString().split('T')[0]; return { start, end }; } },
  { label: 'Last 6 Months', getValue: () => { const d = new Date(); const end = d.toISOString().split('T')[0]; d.setMonth(d.getMonth() - 6); const start = d.toISOString().split('T')[0]; return { start, end }; } },
  { label: 'Last 12 Months', getValue: () => { const d = new Date(); const end = d.toISOString().split('T')[0]; d.setFullYear(d.getFullYear() - 1); const start = d.toISOString().split('T')[0]; return { start, end }; } },
  { label: 'Year to Date', getValue: () => { const d = new Date(); const start = new Date(d.getFullYear(), 0, 1).toISOString().split('T')[0]; const end = d.toISOString().split('T')[0]; return { start, end }; } },
  { label: 'Previous Year', getValue: () => { const d = new Date(); const start = new Date(d.getFullYear() - 1, 0, 1).toISOString().split('T')[0]; const end = new Date(d.getFullYear() - 1, 11, 31).toISOString().split('T')[0]; return { start, end }; } },
  { label: 'All Time', getValue: () => { return { start: '', end: '' }; } }
];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function CustomCalendar({ customStart, customEnd, setCustomStart, setCustomEnd }) {
  const [viewDate, setViewDate] = useState(() => customEnd ? new Date(customEnd) : customStart ? new Date(customStart) : new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));

  const handleDayClick = (d) => {
    // Format properly adjusting for local timezone offset
    const tzOffset = d.getTimezoneOffset() * 60000;
    const dStr = new Date(d.getTime() - tzOffset).toISOString().split('T')[0];

    if (!customStart || (customStart && customEnd)) {
      setCustomStart(dStr);
      setCustomEnd('');
    } else {
      if (new Date(dStr) < new Date(customStart)) {
        setCustomEnd(customStart);
        setCustomStart(dStr);
      } else {
        setCustomEnd(dStr);
      }
    }
  };

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 select-none">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-zinc-200 font-semibold text-sm">{MONTH_NAMES[month]} {year}</span>
        <button onClick={nextMonth} className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <div key={day} className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          if (!d) return <div key={`empty-${i}`} className="w-8 h-8 sm:w-10 sm:h-10" />;
          
          const tzOffset = d.getTimezoneOffset() * 60000;
          const dStr = new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
          
          let isSelected = false;
          let isInRange = false;
          let isStart = false;
          let isEnd = false;

          if (customStart && customEnd) {
            if (dStr === customStart) { isSelected = true; isStart = true; }
            if (dStr === customEnd) { isSelected = true; isEnd = true; }
            if (dStr > customStart && dStr < customEnd) isInRange = true;
          } else if (customStart) {
            if (dStr === customStart) { isSelected = true; isStart = true; }
          }

          const isToday = dStr === new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

          let classes = "w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-xs rounded-full transition-all cursor-pointer relative ";
          
          if (isSelected) {
            classes += "bg-indigo-500 text-white font-bold shadow-md z-10 ";
          } else if (isInRange) {
            classes += "bg-indigo-500/10 text-indigo-300 font-medium ";
            // Optional: make range look connected
            if (!isStart && !isEnd) classes = classes.replace('rounded-full', 'rounded-none');
          } else if (isToday) {
            classes += "text-emerald-400 font-bold border border-emerald-500/30 ";
          } else {
            classes += "text-zinc-300 hover:bg-zinc-800 ";
          }

          return (
            <button key={i} onClick={() => handleDayClick(d)} className={classes}>
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DatePicker({ range, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('presets'); // 'presets' | 'custom'
  const [customStart, setCustomStart] = useState(range?.start || '');
  const [customEnd, setCustomEnd] = useState(range?.end || '');
  
  const containerRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    setCustomStart(range?.start || '');
    setCustomEnd(range?.end || '');
  }, [range]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      const isOutsideContainer = containerRef.current && !containerRef.current.contains(e.target);
      const isOutsideModal = modalRef.current && !modalRef.current.contains(e.target);
      
      if (isOutsideContainer && isOutsideModal) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleApplyCustom = () => {
    onChange({ start: customStart, end: customEnd });
    setIsOpen(false);
  };

  const handlePreset = (preset) => {
    onChange(preset.getValue());
    setIsOpen(false);
  };

  const getDisplayLabel = () => {
    if (!range?.start && !range?.end) return 'All Time';
    
    // Check if it matches a preset
    for (const p of PRESETS) {
      if (p.label === 'All Time') continue;
      const v = p.getValue();
      if (v.start === range.start && v.end === range.end) return p.label;
    }
    
    const startStr = range.start ? new Date(range.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
    const endStr = range.end ? new Date(range.end).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
    
    if (startStr && endStr) return `${startStr} - ${endStr}`;
    if (startStr) return `From ${startStr}`;
    if (endStr) return `Until ${endStr}`;
    return 'Custom Range';
  };

  const renderContent = () => (
    <>
      {/* Mobile Drag Handle */}
      <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-5 md:hidden" />
      
      <div className="md:p-5">
        <div className="flex items-center gap-2 mb-4 p-1 bg-zinc-950 rounded-xl border border-zinc-800 mx-1 md:mx-0">
          <button 
            onClick={() => setActiveTab('presets')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${activeTab === 'presets' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Quick Filters
          </button>
          <button 
            onClick={() => setActiveTab('custom')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${activeTab === 'custom' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Custom Range
          </button>
        </div>

        {activeTab === 'presets' ? (
          <div className="grid grid-cols-2 gap-2 mb-2 max-h-[300px] overflow-y-auto custom-scrollbar px-1 md:px-0">
            {PRESETS.map((preset) => {
              const val = preset.getValue();
              const isActive = val.start === (range?.start || '') && val.end === (range?.end || '');
              return (
                <button
                  key={preset.label}
                  onClick={() => handlePreset(preset)}
                  className={`text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${
                    isActive 
                      ? 'bg-indigo-500/10 text-indigo-400 font-medium border border-indigo-500/20 shadow-inner' 
                      : 'bg-zinc-950/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-zinc-800/50'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="px-1 md:px-0">
            <CustomCalendar 
              customStart={customStart} 
              customEnd={customEnd} 
              setCustomStart={setCustomStart} 
              setCustomEnd={setCustomEnd} 
            />
            
            <div className="flex items-center gap-2 mt-4">
              <button 
                onClick={() => { setCustomStart(''); setCustomEnd(''); }}
                className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors text-sm border border-zinc-700"
              >
                Clear
              </button>
              <button 
                onClick={handleApplyCustom}
                disabled={!customStart || !customEnd}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:bg-indigo-600 text-white font-medium rounded-xl transition-colors text-sm"
              >
                Apply Range
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-full text-sm font-medium text-zinc-300 transition-colors shadow-sm"
      >
        <Calendar size={16} className="text-zinc-500" />
        <span className="truncate max-w-[120px] sm:max-w-[180px]">{getDisplayLabel()}</span>
        <ChevronDown size={14} className="text-zinc-500" />
      </button>

      {isOpen && (
        <>
          {/* Mobile Overlay & Modal (via Portal) */}
          {createPortal(
            <div className="md:hidden" ref={modalRef}>
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] animate-[fadeIn_0.2s_ease-out]" onClick={() => setIsOpen(false)} />
              <div className="fixed bottom-0 left-0 right-0 z-[70] bg-zinc-900 border-t border-zinc-800 rounded-t-3xl p-5 shadow-2xl animate-[slideUp_0.3s_ease-out]">
                {renderContent()}
              </div>
            </div>,
            document.body
          )}
          
          {/* Desktop Dropdown (Inline) */}
          <div className="hidden md:block absolute top-full mt-2 left-1/2 -translate-x-1/2 w-[380px] z-50 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl animate-[scaleIn_0.15s_ease-out] p-0">
            {renderContent()}
          </div>
        </>
      )}
    </div>
  );
}
