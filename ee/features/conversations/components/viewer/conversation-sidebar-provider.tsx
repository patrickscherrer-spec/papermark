import React from "react";

export function ConversationSidebarProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useConversationSidebar() {
  return { isOpen: false, setIsOpen: () => {} };
}