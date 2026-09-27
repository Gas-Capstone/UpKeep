import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { supabase } from "@/lib/supabaseClient";
import { userContext } from "./userContext";

export type Profile = {
  display_name: string | null;
  primary_goal: string | null;
  created_at: string;

  // Profile information
  avatar_url: string | null;
  birthdate: string | null;

  // Biometrics
  height: number | null; // feet.inches, e.g. 5.11 = 5'11"
  weight: number | null; // lbs
  sex: boolean | null; // true = male, false = female
  age: number | null;
};

export type ProfileDataContextType = {
  profile: Profile | null;
  loading: boolean;

  // Refresh entire profile from Supabase
  refreshProfile: () => void;

  // Individual update functions
  updateDisplayName: (displayName: string) => Promise<void>;
  updateAvatar: (avatarUrl: string | null) => Promise<void>;
  updateBirthdate: (birthdate: string | null) => Promise<void>;
  updatePrimaryGoal: (goal: string) => Promise<void>;

  updateBiometrics: (data: {
    height?: number | null;
    weight?: number | null;
    age?: number | null;
    sex?: boolean | null;
  }) => Promise<void>;
};

export const profileDataContext = createContext<ProfileDataContextType | null>(
  null,
);

type ProfileDataProviderProps = {
  children: React.ReactNode;
};

export const ProfileDataProvider = ({ children }: ProfileDataProviderProps) => {
  const { user } = useContext(userContext) ?? {};

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  /*
   * ---------------------------------------------------------
   * Refresh profile
   * ---------------------------------------------------------
   */

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
      .select(
        `
        display_name,
        primary_goal,
        created_at,
        avatar_url,
        birthdate,
        height,
        weight,
        sex,
        age
        `,
      )
      .eq("id", userId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.log("Error fetching profile:", error);
          setProfile(null);
        } else {
          setProfile(data as Profile);
        }

        setLoading(false);
      });
  }, [user?.id]);

  /*
   * Load profile whenever the logged-in user changes
   */

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  /*
   * ---------------------------------------------------------
   * Update display name
   * ---------------------------------------------------------
   */

  const updateDisplayName = useCallback(
    async (displayName: string) => {
      if (!user?.id) return;

      const userId = user.id;

      const cleanedName = displayName.trim();

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: cleanedName,
        })
        .eq("id", userId);

      if (error) {
        console.log("Error updating display name:", error);
        throw error;
      }

      // Immediately update local/shared state
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              display_name: cleanedName,
            }
          : prev,
      );
    },
    [user?.id],
  );

  /*
   * ---------------------------------------------------------
   * Update avatar
   * ---------------------------------------------------------
   */

  const updateAvatar = useCallback(
    async (avatarUrl: string | null) => {
      if (!user?.id) return;

      const userId = user.id;

      const { error } = await supabase
        .from("profiles")
        .update({
          avatar_url: avatarUrl,
        })
        .eq("id", userId);

      if (error) {
        console.log("Error updating avatar:", error);
        throw error;
      }

      // Immediately update local/shared state
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              avatar_url: avatarUrl,
            }
          : prev,
      );
    },
    [user?.id],
  );

  /*
   * ---------------------------------------------------------
   * Update birthdate
   * ---------------------------------------------------------
   */

  const updateBirthdate = useCallback(
    async (birthdate: string | null) => {
      if (!user?.id) return;

      const userId = user.id;

      const { error } = await supabase
        .from("profiles")
        .update({
          birthdate,
        })
        .eq("id", userId);

      if (error) {
        console.log("Error updating birthdate:", error);
        throw error;
      }

      // Immediately update local/shared state
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              birthdate,
            }
          : prev,
      );
    },
    [user?.id],
  );

  /*
   * ---------------------------------------------------------
   * Update primary goal
   * ---------------------------------------------------------
   */

  const updatePrimaryGoal = useCallback(
    async (goal: string) => {
      if (!user?.id) return;

      const userId = user.id;

      const { error } = await supabase
        .from("profiles")
        .update({
          primary_goal: goal,
        })
        .eq("id", userId);

      if (error) {
        console.log("Error updating primary goal:", error);
        throw error;
      }

      // Immediately update local/shared state
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              primary_goal: goal,
            }
          : prev,
      );
    },
    [user?.id],
  );

  /*
   * ---------------------------------------------------------
   * Update biometrics
   * ---------------------------------------------------------
   */

  const updateBiometrics = useCallback(
    async ({
      height,
      weight,
      age,
      sex,
    }: {
      height?: number | null;
      weight?: number | null;
      age?: number | null;
      sex?: boolean | null;
    }) => {
      if (!user?.id) return;

      const userId = user.id;

      /*
       * Only include fields that were actually provided.
       * This prevents accidentally overwriting other biometric
       * values with undefined.
       */
      const updates: {
        height?: number | null;
        weight?: number | null;
        age?: number | null;
        sex?: boolean | null;
      } = {};

      if (height !== undefined) {
        updates.height = height;
      }

      if (weight !== undefined) {
        updates.weight = weight;
      }

      if (age !== undefined) {
        updates.age = age;
      }

      if (sex !== undefined) {
        updates.sex = sex;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);

      if (error) {
        console.log("Error updating biometrics:", error);
        throw error;
      }

      /*
       * Immediately update the shared profile state.
       * Any screen using useProfileData() will re-render.
       */
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              ...updates,
            }
          : prev,
      );
    },
    [user?.id],
  );

  /*
   * ---------------------------------------------------------
   * Context value
   * ---------------------------------------------------------
   */

  const contextValue: ProfileDataContextType = {
    profile,
    loading,
    refreshProfile,

    updateDisplayName,
    updateAvatar,
    updateBirthdate,
    updatePrimaryGoal,
    updateBiometrics,
  };

  return (
    <profileDataContext.Provider value={contextValue}>
      {children}
    </profileDataContext.Provider>
  );
};

/*
 * -----------------------------------------------------------
 * Hook
 * -----------------------------------------------------------
 *
 * Use this instead of:
 *
 * useContext(profileDataContext)
 *
 * It gives a clear error if the provider isn't mounted.
 */

export function useProfileData() {
  const ctx = useContext(profileDataContext);

  if (!ctx) {
    throw new Error(
      "useProfileData must be used within a <ProfileDataProvider>",
    );
  }

  return ctx;
}
