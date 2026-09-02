import React, { useState } from "react";
import { TouchableOpacity, ActivityIndicator, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function FAB({
  onPress,
  icon = "plus",
  style,
  size = 58,
  iconSize = 27,
}) {
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    if (loading) return;
    try {
      setLoading(true);
      if (onPress) {
        await onPress();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={loading}
      activeOpacity={0.8}
      accessibilityRole="button"
      style={[
        {
          position: "absolute",
          right: 16,
          bottom: 24,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#3F8F6B",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.18)",
          shadowColor: "#3F8F6B",
          shadowOpacity: 0.28,
          shadowOffset: {
            width: 0,
            height: 6,
          },
          shadowRadius: 8,
          elevation: 7,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <MaterialCommunityIcons name={icon} size={iconSize} color="#FFFFFF" />
      )}
    </TouchableOpacity>
  );
}
