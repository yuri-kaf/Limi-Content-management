import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { ContentItem } from '../types';
import { stageCardFill, stageCardText, stageCardVars } from '../stageColors';
import { btnIcon, faintText, heading } from '../ui';

interface Props {
  content: ContentItem[];
  canAdd: boolean;
  onDayClick: (date: Date) => void;
  onItemClick: (item: ContentItem) => void;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className={btnIcon} aria-label="Previous month">
          <ChevronLeft size={16} />
        </button>
        <span className={`${heading} text-sm`}>{monthLabel}</span>
        <button onClick={nextMonth} className={btnIcon} aria-label="Next month">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className={`text-center text-[10px] font-semibold py-1 uppercase tracking-wider ${faintText}`}
          >
            {d}
          </div>
        ))}
      </div>

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
              className={`group min-h-[80px] rounded-tile p-1.5 flex flex-col gap-1 border transition-colors duration-100 ${
                todayCell
                  ? 'border-brand/40 bg-brand-soft dark:bg-brand-softdark'
                  : 'border-hairline dark:border-hairline-dark bg-canvas dark:bg-canvas-dark hover:bg-tint dark:hover:bg-tint-dark'
              } ${canAdd ? 'cursor-pointer' : ''}`}
            >
              <div className="flex items-center justify-between px-0.5">
                <span
                  className={`text-[11px] font-semibold leading-none ${todayCell ? 'text-brand-text dark:text-brand-textdark' : faintText}`}
                >
                  {day}
                </span>
                {canAdd && (
                  <Plus
                    size={10}
                    className={`opacity-0 group-hover:opacity-100 transition-opacity ${faintText}`}
                  />
                )}
              </div>

              {/* Each post in its stage's card colours, as on the board: To Post
                  used to be red here and amber everywhere else. */}
              {dayItems.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  onClick={(e) => { e.stopPropagation(); onItemClick(item); }}
                  className={`w-full text-left px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium truncate transition-opacity hover:opacity-80 ${stageCardFill} ${stageCardText}`}
                  style={stageCardVars(item.status)}
                  title={item.title}
                >
                  {item.title}
                </button>
              ))}
              {dayItems.length > 3 && (
                <span className={`text-[10px] px-1 ${faintText}`}>+{dayItems.length - 3} more</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
