import {
  ClipboardList,
  UserSearch,
  LifeBuoy,
  DoorOpen,
  TrendingUp,
  GraduationCap,
  Users,
  Heart,
  BarChart3,
  Wallet,
  MessagesSquare,
  ShieldCheck,
  Plug,
  Compass,
  Sparkles,
  LayoutGrid,
  Circle,
} from "lucide-react";

// Maps the string icon names used in config/categories.js to components.
// Keeping this indirection means the config stays plain data (serializable,
// easy to move to a DB/CMS later) instead of importing React components.
const ICONS = {
  ClipboardList,
  UserSearch,
  LifeBuoy,
  DoorOpen,
  TrendingUp,
  GraduationCap,
  Users,
  Heart,
  BarChart3,
  Wallet,
  MessagesSquare,
  ShieldCheck,
  Plug,
  Compass,
  Sparkles,
  LayoutGrid,
};

export function getIcon(name) {
  return ICONS[name] || Circle;
}
