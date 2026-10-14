import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { ContentItem } from '../types';
import { stageCardFill, stageCardText, stageCardVars } from '../stageColors';
import { btnIcon, card, faintText, heading, focusRing, focusRingInset, todayMark } from '../ui';
import { toDateInput } from '../utils';

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

  // Whole weeks, Sunday first. The neighbouring months' days fill the first
  // and last week, so the grid is one unbroken block like Apple's and Notion's.
  const startPad = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((startPad + totalDays) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => new Date(year, month, 1 - startPad + i));

  function prevMonth() {
    setViewDate(new Date(year, month - 1, 1));
  }
  function nextMonth() {
    setViewDate(new Date(year, month + 1, 1));
  }

  const scheduledItems = content.filter((item) => item.scheduledAt && item.scheduledAt > 0);
  const itemsOn = (d: Date) => scheduledItems.filter((item) => isSameDay(new Date(item.scheduledAt!), d));

  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

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

      {/* One block with hairline rules between the days, not a box per day:
          the 1px gaps show the hairline background through. */}
      <div className={`${card} overflow-hidden`}>
        <div className="grid grid-cols-7 border-b border-hairline dark:border-hairline-dark">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className={`text-center text-[11px] font-medium py-2 uppercase tracking-wider ${faintText}`}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-hairline dark:bg-hairline-dark">
          {cells.map((d) => {
            const outside = d.getMonth() !== month;
            const isToday = isSameDay(d, today);
            const dayItems = itemsOn(d);

            return (
              <div
                key={d.getTime()}
                data-date={toDateInput(d.getTime())}
                data-outside={outside ? '' : undefined}
                aria-current={isToday ? 'date' : undefined}
                onClick={() => canAdd && onDayClick(d)}
                className={`group min-h-[88px] p-1.5 flex flex-col gap-1 transition-colors duration-100 ${
                  outside ? 'bg-tint dark:bg-tint-dark' : 'bg-surface dark:bg-surface-dark'
                } ${canAdd ? 'cursor-pointer hover:bg-hover dark:hover:bg-hover-dark' : ''}`}
              >
                <div className="flex items-center justify-between">
                  {/* The number is drawing; the date is read out in full. */}
                  <span className="sr-only">
                    {isToday ? 'Today, ' : ''}
                    {d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </span>
                  {/* Today is its number in a filled circle and nothing more. */}
                  <span
                    aria-hidden="true"
                    className={
                      isToday
                        ? todayMark
                        : `inline-flex items-center justify-center h-6 min-w-6 text-[12px] font-medium tabular-nums ${
                            outside ? faintText : 'text-ink-soft dark:text-ink-softdark'
                          }`
                    }
                  >
                    {d.getDate()}
                  </span>
                  {/* The cell takes a click for the pointer; this is the same
                      action for a keyboard and a screen reader. Shown on hover or
                      focus, and always where there is no hover to reveal it. */}
                  {canAdd && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDayClick(d); }}
                      aria-label={`Add post on ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
                      className={`w-6 h-6 [@media(hover:none)]:w-8 [@media(hover:none)]:h-8 inline-flex items-center justify-center rounded-tile opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-[opacity,background-color,color] ${faintText} hover:text-ink dark:hover:text-ink-dark hover:bg-canvas dark:hover:bg-canvas-dark ${focusRing}`}
                    >
                      <Plus size={12} />
                    </button>
                  )}
                </div>

                {/* Each post in its stage's card colours, as on the board. */}
                {dayItems.slice(0, 3).map((item) => (
                  <button
                    key={item.id}
                    onClick={(e) => { e.stopPropagation(); onItemClick(item); }}
                    className={`w-full text-left px-1.5 py-0.5 rounded-chip text-[11px] font-medium truncate transition-[filter] duration-100 hover:brightness-95 dark:hover:brightness-110 ${focusRingInset} ${stageCardFill} ${stageCardText}`}
                    style={stageCardVars(item.status)}
                    title={item.title}
                  >
                    {item.title}
                  </button>
                ))}
                {dayItems.length > 3 && (
                  <span className={`text-[11px] px-1 ${faintText}`}>+{dayItems.length - 3} more</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
