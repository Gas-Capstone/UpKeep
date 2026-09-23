import {
  BottomTabInset,
  MaxContentWidth,
  Spacing,
  TopBadgeInset,
} from "@/constants/theme";
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    flexDirection: "row",
  },
  columnContainer: {
    flex: 1,
    flexDirection: "column",
    flexWrap: "wrap",
    alignSelf: "stretch",
    alignItems: "stretch",
    justifyContent: "center",
  },
  safeAreaView: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: "center",
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    paddingTop: TopBadgeInset,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  rowBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  title: {
    textAlign: "center",
  },
  code: {
    textTransform: "uppercase",
  },
  stepContainer: {
    gap: Spacing.three,
    alignSelf: "stretch",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: 16,
  },
  centerContent: {
    flex: 1,
    gap: Spacing.three,
  },
  animatedFABStyle: {
    bottom: BottomTabInset + Spacing.two,
    right: Spacing.three,
    position: "absolute",
  },
  modalContent: {
    justifyContent: "center",
    paddingHorizontal: Spacing.four,
  },
  modalCard: {
    alignSelf: "center",
    width: "100%",
    maxWidth: MaxContentWidth,
  },
  safeArea: {
    flex: 1,
    alignItems: "center",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  screen: {
    flex: 1,
  },
  scrollContent: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset,
  },
  headerStyle: {
    width: "100%",
    paddingHorizontal: Spacing.four,
    paddingTop: TopBadgeInset,
  },
});
