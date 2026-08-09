import { useEffect } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { createLogger } from "../../logger";

const log = createLogger("ar-navigator");

interface Props {
  markersCount: number;
  onReady: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function ARSceneView({ onReady, style }: Props) {
  useEffect(() => {
    log.info("AR navigator is using the web fallback");
    onReady();
  }, [onReady]);

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.text}>AR is available on iOS and Android.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#111118",
    justifyContent: "center",
  },
  text: {
    color: "#B8B8C2",
    fontSize: 15,
  },
});
