import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";

import { useUserContext } from "@/components/context/userContext";

type TourContextType = {
  visible: boolean;
  startTour: () => void;
  finishTour: () => void;
};

const TourContext = createContext<TourContextType | null>(null);

// Stored per user so a second account on the same phone still gets the tour.
function storageKey(userId: string) {
  return `app-tour-seen:${userId}`;
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUserContext();
  // The id of the user the tour is open for, so signing out hides it.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const visible = !!user?.id && openFor === user.id;

  useEffect(() => {
    if (!user?.id) return;

    let active = true;
    const userId = user.id;

    AsyncStorage.getItem(storageKey(userId))
      .then((seen) => {
        if (active && !seen) setOpenFor(userId);
      })
      .catch(() => {
        // If storage can't be read, skip the tour rather than showing it every launch.
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  function startTour() {
    if (user?.id) setOpenFor(user.id);
  }

  function finishTour() {
    setOpenFor(null);
    if (!user?.id) return;

    AsyncStorage.setItem(storageKey(user.id), "seen").catch(() => {});
  }

  return (
    <TourContext.Provider value={{ visible, startTour, finishTour }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error("useTour must be used within a <TourProvider>");
  }
  return ctx;
}
