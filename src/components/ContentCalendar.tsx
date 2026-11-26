import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from '../icons';
import { ContentItem } from '../types';
import { stageCardVars, stageDot } from '../stageColors';
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
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <span className={`${heading} text-[16px] mr-auto`}>{monthLabel}</span>
        <button onClick={prevMonth} className={btnIcon} aria-label="Previous month">
          <ChevronLeft size={18} />
        </button>
        <button onClick={nextMonth} className={btnIcon} aria-label="Next month">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* One soft block, no outlines: the days are told apart by a hairline
          between them, and the neighbouring months by a quieter fill. */}
      <div className={`${card} overflow-hidden`}>
        <div className="grid grid-cols-7">
          {WEEKDAYS.map((d) => (
            <div key={d} className={`text-center text-[12px] font-medium py-2 ${faintText}`}>
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-hairline dark:bg-hairline-dark border-t border-hairline dark:border-hairline-dark">
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
                className={`group min-h-[64px] sm:min-h-[92px] p-1 sm:p-1.5 flex flex-col gap-1 transition-colors duration-100 ${
                  outside ? 'bg-raised dark:bg-raised-dark' : 'bg-canvas dark:bg-canvas-dark'
                } ${canAdd ? 'cursor-pointer hover:bg-hover/60 dark:hover:bg-hover-dark/60' : ''}`}
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
                      className={`hidden sm:inline-flex w-6 h-6 [@media(hover:none)]:w-8 [@media(hover:none)]:h-8 items-center justify-center rounded-full opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition-[opacity,background-color,color] ${faintText} hover:text-ink dark:hover:text-ink-dark hover:bg-ink/[.08] dark:hover:bg-ink-dark/[.08] ${focusRing}`}
                    >
                      <Plus size={16} />
                    </button>
                  )}
                </div>

                {/* Each post a compact chip: its stage's dot and its title. On
                    a phone the cell is too narrow for a title, so the dot is
                    the chip. */}
                <div className="flex flex-wrap sm:flex-col gap-0.5">
                  {dayItems.slice(0, 3).map((item) => (
                    <button
                      key={item.id}
                      onClick={(e) => { e.stopPropagation(); onItemClick(item); }}
                      aria-label={item.title}
                      className={`inline-flex items-center justify-center sm:justify-start gap-1.5 min-w-5 h-5 sm:w-full px-1 rounded-chip text-left text-[11px] font-medium text-ink dark:text-ink-dark hover:bg-ink/[.08] dark:hover:bg-ink-dark/[.1] transition-colors ${focusRingInset}`}
                      style={stageCardVars(item.status)}
                      title={item.title}
                    >
                      <span aria-hidden="true" className={`w-2 h-2 rounded-full flex-shrink-0 ${stageDot}`} />
                      <span aria-hidden="true" className="hidden sm:block truncate">{item.title}</span>
                    </button>
                  ))}
                </div>
                {dayItems.length > 3 && (
                  <span className={`text-[11px] px-1 ${faintText}`}>+{dayItems.length - 3}<span className="hidden sm:inline"> more</span></span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
