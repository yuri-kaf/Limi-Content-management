import { CSSProperties } from 'react';
// Brand marks are not in Material Symbols, so these two stay as drawn glyphs.
export { Facebook, Instagram } from 'lucide-react';

// Material Symbols Rounded, the icon set of Material 3, drawn from a font that
// index.html loads subset to exactly the names below (ICON_NAMES). Each export
// keeps the name the app used under lucide, so a call site reads the same and
// only its import path changed. The glyph is drawn by CSS from data-icon
// (index.css), so its ligature name is never part of the text: not in a
// button's textContent, not in a copy and paste. icons.test.ts fails if a name here is missing
// from the font URL, which would otherwise render as its ligature text.
const MAP = {
  AlertCircle: 'error',
  AlertTriangle: 'warning',
  ArrowDown: 'arrow_downward',
  ArrowLeft: 'arrow_back',
  ArrowRight: 'arrow_forward',
  ArrowUp: 'arrow_upward',
  Ban: 'block',
  Bell: 'notifications',
  Building2: 'store',
  Calendar: 'calendar_today',
  CalendarClock: 'event_upcoming',
  CalendarDays: 'calendar_month',
  CalendarPlus: 'calendar_add_on',
  Campaign: 'campaign',
  Carousel: 'view_carousel',
  Check: 'check',
  CheckCircle: 'check_circle',
  CheckCircle2: 'check_circle',
  ChevronDown: 'expand_more',
  ChevronLeft: 'chevron_left',
  ChevronRight: 'chevron_right',
  Clock: 'schedule',
  Columns3: 'view_kanban',
  Copy: 'content_copy',
  CornerDownLeft: 'keyboard_return',
  DarkMode: 'dark_mode',
  DoneAll: 'done_all',
  Download: 'download',
  ExternalLink: 'open_in_new',
  Eye: 'visibility',
  EyeOff: 'visibility_off',
  Film: 'movie',
  FilterList: 'filter_list',
  Footprints: 'footprint',
  Globe: 'language',
  GripVertical: 'drag_indicator',
  Handshake: 'handshake',
  Hash: 'tag',
  History: 'history',
  Home: 'home',
  Hourglass: 'hourglass_top',
  Image: 'image',
  Inbox: 'inbox',
  Info: 'info',
  KeyRound: 'key',
  LayoutGrid: 'grid_view',
  Lightbulb: 'lightbulb',
  Link: 'link',
  Link2: 'link',
  ListChecks: 'checklist',
  LogOut: 'logout',
  Mail: 'mail',
  Megaphone: 'campaign',
  Menu: 'menu',
  MenuOpen: 'menu_open',
  MessageCircle: 'chat_bubble',
  Moon: 'dark_mode',
  MoreHorizontal: 'more_horiz',
  MoreVertical: 'more_vert',
  PanelLeftClose: 'left_panel_close',
  PanelLeftOpen: 'left_panel_open',
  PartyPopper: 'celebration',
  Pencil: 'edit',
  Phone: 'call',
  Play: 'play_arrow',
  Plus: 'add',
  RotateCcw: 'undo',
  Search: 'search',
  Send: 'send',
  Shield: 'shield',
  SlidersHorizontal: 'tune',
  Sort: 'sort',
  Star: 'star',
  Sun: 'light_mode',
  SunMoon: 'contrast',
  Target: 'person_search',
  Today: 'today',
  Trash2: 'delete',
  User: 'person',
  Users: 'group',
  X: 'close',
  XCircle: 'cancel',
} as const;

export type IconName = keyof typeof MAP;

/** Every glyph the app draws, sorted as the Google Fonts icon_names list must be. */
export const ICON_NAMES: string[] = [...new Set(Object.values(MAP))].sort();

export interface IconProps {
  size?: number | string;
  className?: string;
  style?: CSSProperties;
  /** Solid glyph. Also turned on by a Tailwind `fill-*` class, as lucide stars used. */
  filled?: boolean;
  /** Accepted for lucide compatibility; weight is set by the font. */
  strokeWidth?: number;
  'aria-hidden'?: boolean | 'true' | 'false';
  'aria-label'?: string;
  title?: string;
}

function kebab(name: string) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function make(name: IconName) {
  const glyph = MAP[name];
  const cls = `icon-${kebab(name)}`;
  function Icon({ size = 20, className = '', style, filled, strokeWidth: _s, title, ...aria }: IconProps) {
    const solid = filled || /(^|\s)(dark:)?fill-/.test(className);
    const labelled = !!aria['aria-label'];
    return (
      <span
        className={`material-symbols-rounded ${cls} ${className}`}
        style={{
          fontSize: typeof size === 'number' ? `${size}px` : size,
          fontVariationSettings: `'FILL' ${solid ? 1 : 0}`,
          ...style,
        }}
        role={labelled ? 'img' : undefined}
        aria-hidden={labelled ? undefined : (aria['aria-hidden'] ?? true)}
        aria-label={aria['aria-label']}
        title={title}
        translate="no"
        data-icon={glyph}
      />
    );
  }
  Icon.displayName = name;
  return Icon;
}

export type IconComponent = ReturnType<typeof make>;

export const AlertCircle = make('AlertCircle');
export const AlertTriangle = make('AlertTriangle');
export const ArrowDown = make('ArrowDown');
export const ArrowLeft = make('ArrowLeft');
export const ArrowRight = make('ArrowRight');
export const ArrowUp = make('ArrowUp');
export const Ban = make('Ban');
export const Bell = make('Bell');
export const Building2 = make('Building2');
export const Calendar = make('Calendar');
export const CalendarClock = make('CalendarClock');
export const CalendarDays = make('CalendarDays');
export const CalendarPlus = make('CalendarPlus');
export const Campaign = make('Campaign');
export const Carousel = make('Carousel');
export const Check = make('Check');
export const CheckCircle = make('CheckCircle');
export const CheckCircle2 = make('CheckCircle2');
export const ChevronDown = make('ChevronDown');
export const ChevronLeft = make('ChevronLeft');
export const ChevronRight = make('ChevronRight');
export const Clock = make('Clock');
export const Columns3 = make('Columns3');
export const Copy = make('Copy');
export const CornerDownLeft = make('CornerDownLeft');
export const DarkMode = make('DarkMode');
export const DoneAll = make('DoneAll');
export const Download = make('Download');
export const ExternalLink = make('ExternalLink');
export const Eye = make('Eye');
export const EyeOff = make('EyeOff');
export const Film = make('Film');
export const FilterList = make('FilterList');
export const Footprints = make('Footprints');
export const Globe = make('Globe');
export const GripVertical = make('GripVertical');
export const Handshake = make('Handshake');
export const Hash = make('Hash');
export const History = make('History');
export const Home = make('Home');
export const Hourglass = make('Hourglass');
export const Image = make('Image');
export const Inbox = make('Inbox');
export const Info = make('Info');
export const KeyRound = make('KeyRound');
export const LayoutGrid = make('LayoutGrid');
export const Lightbulb = make('Lightbulb');
export const Link = make('Link');
export const Link2 = make('Link2');
export const ListChecks = make('ListChecks');
export const LogOut = make('LogOut');
export const Mail = make('Mail');
export const Megaphone = make('Megaphone');
export const Menu = make('Menu');
export const MenuOpen = make('MenuOpen');
export const MessageCircle = make('MessageCircle');
export const Moon = make('Moon');
export const MoreHorizontal = make('MoreHorizontal');
export const MoreVertical = make('MoreVertical');
export const PanelLeftClose = make('PanelLeftClose');
export const PanelLeftOpen = make('PanelLeftOpen');
export const PartyPopper = make('PartyPopper');
export const Pencil = make('Pencil');
export const Phone = make('Phone');
export const Play = make('Play');
export const Plus = make('Plus');
export const RotateCcw = make('RotateCcw');
export const Search = make('Search');
export const Send = make('Send');
export const Shield = make('Shield');
export const SlidersHorizontal = make('SlidersHorizontal');
export const Sort = make('Sort');
export const Star = make('Star');
export const Sun = make('Sun');
export const SunMoon = make('SunMoon');
export const Target = make('Target');
export const Today = make('Today');
export const Trash2 = make('Trash2');
export const User = make('User');
export const Users = make('Users');
export const X = make('X');
export const XCircle = make('XCircle');
