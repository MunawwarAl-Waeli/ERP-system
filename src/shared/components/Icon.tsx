import React from "react";
import {
  LayoutDashboard,
  Users,
  Receipt,
  PackageOpen,
  Package,
  MoreHorizontal,
  MoreVertical,
  TrendingUp,
  HandCoins,
  BarChart3,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Tag,
  Barcode,
  AlertCircle,
  AlertTriangle,
  Info,
  Phone,
  MapPin,
  StickyNote,
  Delete,
  Settings,
  Printer,
  LockKeyhole,
  Upload,
  Download,
  X,
  Plus,
  UserPlus,
  BadgeIndianRupee,
  Minus,
  Search,
  Banknote,
  Smartphone,
  CreditCard,
  Clock,
  Calendar,
  History,
  Trash2,
  ShoppingCart,
  User,
  Check,
  Pencil,
  Percent,
  Share2,
  Bluetooth,
  CheckCircle2,
  Eye,
  EyeOff,
  Cloud,
  LogIn,
  LogOut,
  RefreshCw,
  Database,
  Coffee,
  Cookie,
  CupSoda,
  Wheat,
  Nut,
  Milk,
  Flame,
  Sparkles,
  Box,
  Droplets,
  UtensilsCrossed,
  FlaskConical,
  Drumstick,
  Container,
  Folder,
  PlusCircle,
  Landmark,
  Scale,
  Shield,
  TrendingDown,
  Square,
  MinusSquare,
  ReceiptText,
  FolderOpen,
  FileText,
  Truck,
  Calculator,
  BookOpen,
  BookUser,
  ArrowDownUp,
  WalletCards,
  ShieldCheck,
  Network,
  Wallet,
  MessageCircle,
  MessageSquare,
  type LucideProps,
} from "lucide-react-native";

const iconMap: Record<string, React.FC<LucideProps>> = {
  // Navigation & Core
  "view-dashboard": LayoutDashboard,
  "account-group": Users,
  users: Users,
  receipt: Receipt,
  "package-variant-closed": PackageOpen,
  "package-variant": Package,
  "dots-horizontal": MoreHorizontal,
  "dots-vertical": MoreVertical,
  "more-vertical": MoreVertical,

  // Actions & Controls
  close: X,
  x: X,
  plus: Plus,
  minus: Minus,
  "account-plus": UserPlus,
  delete: Trash2,
  "trash-2": Trash2,
  pencil: Pencil,
  check: Check,
  "check-circle": CheckCircle2,
  "check-circle-outline": CheckCircle2,
  square: Square,
  "checkbox-blank": Square,
  "minus-square": MinusSquare,
  cog: Settings,
  settings: Settings,

  // Communication & Media
  phone: Phone,
  whatsapp: MessageCircle,
  sms: MessageSquare,
  "file-pdf-box": FileText,
  "file-text": FileText,

  // Filters & Status Icons
  magnify: Search,
  search: Search,
  filter: ArrowUpDown,
  "alert-circle": AlertCircle,
};

export interface AppIconProps {
  name: string;
  size?: number;
  color?: string;
  style?: object;
}

export const AppIcon: React.FC<AppIconProps> = ({
  name,
  size = 20,
  color,
  style,
}) => {
  const LucideComponent = iconMap[name];
  if (!LucideComponent) {
    console.warn(`[AppIcon] Unknown icon name: "${name}"`);
    return null;
  }
  return <LucideComponent size={size} color={color} style={style} />;
};

export const paperIcon = (name: string) => {
  return ({ size, color }: { size: number; color: string }) => (
    <AppIcon name={name} size={size} color={color} />
  );
};
