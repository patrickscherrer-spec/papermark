// Ein universelles Fallback-Modul für alle EE-Funktionen
const emptyFn = () => null;
const useEmptyHook = () => ({});

export const resolveBrandLogo = emptyFn;
export const resolveDataroomBanner = emptyFn;
export const useViewerRequestList = useEmptyHook;
export const ViewerChatProvider = emptyFn;
export const ConversationViewSidebar = emptyFn;
export const useConversationSidebar = () => ({ isOpen: false, setIsOpen: emptyFn });
export const ConversationSidebarProvider = ({ children }: any) => children;

export default function DefaultFallback() {
  return null;
}