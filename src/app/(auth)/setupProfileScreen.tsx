import { useState } from "react";
import { View, Image, Platform } from "react-native";
import { supabase } from "@/lib/supabaseClient";
import { router } from "expo-router";

import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";

import { Spacing, MaxContentWidth } from "@/constants/theme";

import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";

// `height` is stored as feet.inches (e.g. 5.11 = 5'11")
function buildHeightValue(feetStr: string, inchesStr: string): number | null {
  const feet = Number(feetStr);
  if (!feetStr || Number.isNaN(feet)) return null;

  const rawInches = Number(inchesStr);
  const inches = Number.isNaN(rawInches)
    ? 0
    : Math.min(Math.max(Math.round(rawInches), 0), 11);
  const inchesPadded = String(inches).padStart(2, "0");

  return Number(`${feet}.${inchesPadded}`);
}

export default function SetupProfileScreen() {
  const [displayName, setDisplayName] = useState("");

  const [birthdate, setBirthdate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [avatarUri, setAvatarUri] = useState("");

  // Calorie-goal inputs
  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [weight, setWeight] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<boolean | null>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // -----------------------------
  // IMAGE PICKER
  // -----------------------------
  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  }

  // -----------------------------
  // SUBMIT PROFILE
  // -----------------------------
  async function handleSubmit() {
    setLoading(true);
    setError("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("You must be logged in.");
      setLoading(false);
      return;
    }

    // Upload avatar if provided
    let avatarUrl = null;

    if (avatarUri.length > 0) {
      const file = {
        uri: avatarUri,
        name: `avatar-${user.id}.jpg`,
        type: "image/jpeg",
      };

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(`${user.id}/avatar.jpg`, file, { upsert: true });

      if (uploadError) {
        setError(uploadError.message);
        setLoading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(`${user.id}/avatar.jpg`);

      avatarUrl = urlData.publicUrl;
    }

    // Update profile with onboarding flag
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        display_name: displayName || null,
        birthdate: birthdate ? birthdate.toISOString().split("T")[0] : null,
        avatar_url: avatarUrl || null,
        height: buildHeightValue(heightFeet, heightInches),
        weight: weight ? Number(weight) : null,
        age: age ? Number(age) : null,
        sex: sex,
        onboarding_complete: true,
      })
      .eq("id", user.id);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    router.replace("/");
  }

  return (
    <View className="flex-1 items-center justify-center px-6">
      <ThemedView
        type="backgroundElement"
        style={{
          width: "100%",
          maxWidth: MaxContentWidth,
          padding: Spacing.four,
          borderRadius: Spacing.five,
          shadowColor: "#000",
          shadowOpacity: 0.15,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
        }}
      >
        <ThemedText type="title" style={{ marginBottom: Spacing.four }}>
          Getting to know you...
        </ThemedText>

        {error.length > 0 && (
          <ThemedText
            type="smallBold"
            style={{ color: "red", marginBottom: Spacing.four }}
          >
            {error}
          </ThemedText>
        )}

        {/* Display Name */}
        <Input
          placeholder="How would you like to be called?"
          value={displayName}
          onChangeText={setDisplayName}
          className="mb-4"
        />

        {/* Birthday Picker */}
        <Button onPress={() => setShowDatePicker(true)}>
          {birthdate
            ? `Birthday: ${birthdate.toDateString()}`
            : "Choose your birthday"}
        </Button>

        {showDatePicker && (
          <DateTimePicker
            value={birthdate || new Date()}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "calendar"}
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) setBirthdate(selectedDate);
            }}
          />
        )}

        {/* Height */}
        <ThemedText
          type="smallBold"
          style={{ marginTop: Spacing.four, marginBottom: Spacing.two }}
        >
          Height
        </ThemedText>
        <HStack space="sm" style={{ marginBottom: Spacing.four }}>
          <Input
            placeholder="Feet"
            value={heightFeet}
            onChangeText={setHeightFeet}
            keyboardType="numeric"
            style={{ flex: 1 }}
          />
          <Input
            placeholder="Inches"
            value={heightInches}
            onChangeText={setHeightInches}
            keyboardType="numeric"
            style={{ flex: 1 }}
          />
        </HStack>

        {/* Weight */}
        <ThemedText type="smallBold" style={{ marginBottom: Spacing.two }}>
          Weight (lbs)
        </ThemedText>
        <Input
          placeholder="Weight in pounds"
          value={weight}
          onChangeText={setWeight}
          keyboardType="numeric"
          className="mb-4"
        />

        {/* Age */}
        <ThemedText type="smallBold" style={{ marginBottom: Spacing.two }}>
          Age
        </ThemedText>
        <Input
          placeholder="Age"
          value={age}
          onChangeText={setAge}
          keyboardType="numeric"
          className="mb-4"
        />

        {/* Sex */}
        <ThemedText type="smallBold" style={{ marginBottom: Spacing.two }}>
          Sex
        </ThemedText>
        <HStack space="sm" style={{ marginBottom: Spacing.four }}>
          <View style={{ flex: 1 }}>
            <Button onPress={() => setSex(true)}>
              {sex === true ? "✓ Male" : "Male"}
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button onPress={() => setSex(false)}>
              {sex === false ? "✓ Female" : "Female"}
            </Button>
          </View>
        </HStack>

        {/* Avatar Picker */}
        <Button onPress={pickAvatar}>
          {avatarUri ? "Change Avatar" : "Pick an Avatar"}
        </Button>

        {avatarUri.length > 0 && (
          <Image
            source={{ uri: avatarUri }}
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              marginBottom: Spacing.four,
            }}
          />
        )}

        <Button onPress={handleSubmit} isDisabled={loading}>
          Save & Continue
        </Button>
      </ThemedView>
    </View>
  );
}
