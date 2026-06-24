import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { ContentItem } from '../types';

interface Props {
  content: ContentItem[];
  canAdd: boolean;
  onDayClick: (date: Date) => void;
  onItemClick: (item: ContentItem) => void;
}

const STATUS_COLORS: Record<string, string> = {
  editing: '#d97706',
  review: '#2563eb',
  'to-post': '#dc2626',
  posted: '#059669',
};

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function ContentCalendar({ content, canAdd, onDayClick, onItemClick }: Props) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const totalDays = lastDay.getDate();

  function prevMonth() {
    setViewDate(new Date(year, month - 1, 1));
  }
  function nextMonth() {
    setViewDate(new Date(year, month + 1, 1));
  }

  const scheduledItems = content.filter((item) => item.scheduledAt && item.scheduledAt > 0);

  function itemsForDay(day: number): ContentItem[] {
    const d = new Date(year, month, day);
    return scheduledItems.filter((item) => isSameDay(new Date(item.scheduledAt!), d));
  }

  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const isToday = (day: number) => isSameDay(new Date(year, month, day), today);

  const cells: (number | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="flex flex-col gap-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg text-neutral-400 dark:text-[#555] hover:text-neutral-600 dark:hover:text-[#999] hover:bg-neutral-100 dark:hover:bg-[#1a1a1a] transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-neutral-900 dark:text-white">{monthLabel}</span>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg text-neutral-400 dark:text-[#555] hover:text-neutral-600 dark:hover:text-[#999] hover:bg-neutral-100 dark:hover:bg-[#1a1a1a] transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-neutral-400 dark:text-[#444] py-1 uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={`pad-${idx}`} />;
          const dayItems = itemsForDay(day);
          const todayCell = isToday(day);
          const d = new Date(year, month, day);

          return (
            <div
              key={day}
              onClick={() => canAdd && onDayClick(d)}
              className={`group min-h-[80px] rounded-xl p-1.5 flex flex-col gap-1 border transition-all duration-100 ${
                todayCell
                  ? 'border-[#dc2626]/40 bg-[#dc2626]/5'
                  : 'border-neutral-200 dark:border-[#1a1a1a] bg-neutral-50 dark:bg-[#0d0d0d] hover:border-neutral-300 dark:hover:border-[#2a2a2a]'
              } ${canAdd ? 'cursor-pointer' : ''}`}
            >
              {/* Day number */}
              <div className="flex items-center justify-between px-0.5">
                <span
                  className={`text-[11px] font-semibold leading-none ${
                    todayCell ? 'text-[#dc2626]' : 'text-neutral-400 dark:text-[#555]'
                  }`}
                >
                  {day}
                </span>
                {canAdd && (
                  <Plus
                    size={10}
                    className="text-neutral-300 dark:text-[#333] opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                )}
              </div>

              {/* Content chips */}
              {dayItems.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  onClick={(e) => { e.stopPropagation(); onItemClick(item); }}
                  className="w-full text-left px-1.5 py-0.5 rounded-md text-[9px] font-medium truncate transition-opacity hover:opacity-80"
                  style={{
                    backgroundColor: `${STATUS_COLORS[item.status]}20`,
                    color: STATUS_COLORS[item.status],
                    border: `1px solid ${STATUS_COLORS[item.status]}30`,
                  }}
                >
                  {item.title}
                </button>
              ))}
              {dayItems.length > 3 && (
                <span className="text-[9px] text-neutral-400 dark:text-[#444] px-1">+{dayItems.length - 3} more</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
