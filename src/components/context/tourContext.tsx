import { createContext, useContext, useEffect, useState } from "react";

import { useUserContext } from "@/components/context/userContext";
import { hasSeenTour, markTourSeen } from "@/lib/supabaseFunctions";

type TourContextType = {
  visible: boolean;
  // Called when Home is opened. Starts the tour if this account hasn't seen it.
  startFirstVisitTour: () => void;
  // Replays the tour on demand (Settings).
  startTour: () => void;
  finishTour: () => void;
};

const TourContext = createContext<TourContextType | null>(null);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUserContext();
  // The id of the user the tour is open for, so signing out hides it.
  const [openFor, setOpenFor] = useState<string | null>(null);
  // The id of a user who hasn't seen the tour yet, once that's been checked.
  const [unseenFor, setUnseenFor] = useState<string | null>(null);
  const visible = !!user?.id && openFor === user.id;

  useEffect(() => {
    if (!user?.id) return;

    let active = true;
    const currentUser = user;

    hasSeenTour(currentUser).then((seen) => {
      if (active && !seen) setUnseenFor(currentUser.id);
    });

    return () => {
      active = false;
    };
  }, [user]);

  function startFirstVisitTour() {
    if (!user?.id || unseenFor !== user.id) return;
    setUnseenFor(null);
    setOpenFor(user.id);
    // Saved as soon as it opens, so closing the app mid-tour doesn't bring it
    // back on the next visit.
    markTourSeen(user);
  }

  function startTour() {
    if (user?.id) setOpenFor(user.id);
  }

  function finishTour() {
    setOpenFor(null);
  }

  return (
    <TourContext.Provider
      value={{ visible, startFirstVisitTour, startTour, finishTour }}
    >
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
