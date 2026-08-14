import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { userContext } from "./userContext";

// Lifted out of profile.tsx/settings.tsx's separate local fetches so
// index.tsx can read the same profile row (height/weight/sex for calorie
// goal calculation) without a third redundant query.

export type Profile = {
  name: string | null;
  primary_goal: string | null;
  created_at: string;
  height: number | null; // feet.inches, e.g. 5.11 = 5'11"
  weight: number | null; // lbs
  sex: boolean | null; // true = male, false = female
  age: number | null;
};

export type ProfileDataContextType = {
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => void;
  updatePrimaryGoal: (goal: string) => Promise<void>;
};

export const profileDataContext = createContext<ProfileDataContextType | null>(null);

type ProfileDataProviderProps = {
  children: React.ReactNode;
};

export const ProfileDataProvider = ({ children }: ProfileDataProviderProps) => {
  const { user } = useContext(userContext) ?? {};
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(() => {
    if (!user?.id) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const userId = user.id;
    setLoading(true);
    supabase
      .from("profiles")
      .select("display_name, primary_goal, created_at, height, weight, sex, age")
      .eq("id", userId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.log("Error fetching profile: ", error);
          setProfile(null);
        } else {
          setProfile(data);
        }
        setLoading(false);
      });
  }, [user?.id]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const updatePrimaryGoal = useCallback(
    async (goal: string) => {
      if (!user?.id) return;
      const userId = user.id;
      const { error } = await supabase
        .from("profiles")
        .update({ primary_goal: goal })
        .eq("id", userId);

      if (error) throw error;
      setProfile((prev) => (prev ? { ...prev, primary_goal: goal } : prev));
    },
    [user?.id]
  );

  const contextValue: ProfileDataContextType = {
    profile,
    loading,
    refreshProfile,
    updatePrimaryGoal,
  };

  return (
    <profileDataContext.Provider value={contextValue}>
      {children}
    </profileDataContext.Provider>
  );
};

// Use this instead of `useContext(profileDataContext)` — throws a clear error if <ProfileDataProvider> isn't mounted.
export function useProfileData() {
  const ctx = useContext(profileDataContext);
  if (!ctx) {
    throw new Error("useProfileData must be used within a <ProfileDataProvider>");
  }
  return ctx;
}
