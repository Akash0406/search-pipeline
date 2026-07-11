/**
 * `@careerstack/ui` — shared React design system built on shadcn/ui + Radix +
 * Tailwind v4. One unified design language consumed by `apps/web` via Next.js
 * `transpilePackages`. Import styles once with `@careerstack/ui/globals.css`.
 */
export const UI_PACKAGE = '@careerstack/ui' as const;

export { cn } from './lib/utils';

export { Button, buttonVariants, type ButtonProps } from './components/button';
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from './components/card';
export { Input } from './components/input';
export { Label } from './components/label';
export { Badge, badgeVariants, type BadgeProps } from './components/badge';
export { Skeleton } from './components/skeleton';
export { Separator } from './components/separator';
export { Avatar, AvatarImage, AvatarFallback } from './components/avatar';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './components/tabs';

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './components/dialog';

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from './components/sheet';

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from './components/dropdown-menu';

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './components/tooltip';

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from './components/command';

export { Toaster, toast } from './components/sonner';
export { ThemeProvider } from './components/theme-provider';

export { useMediaQuery } from './hooks/use-media-query';
