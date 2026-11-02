/**
 * Safe Image Picker Service
 * Dynamically resolves expo-image-picker without crashing the module load
 * when running in environments where the native module is not compiled in.
 */

import { Alert, Platform } from "react-native";
import { PhotoAsset } from "./proformaService";

let _imagePickerModule: any = null;
let _moduleChecked = false;

function getImagePicker() {
  if (_moduleChecked) return _imagePickerModule;
  _moduleChecked = true;
  try {
    // Dynamic require inside try-catch to prevent ExponentImagePicker crash at bundle time
    const mod = require("expo-image-picker");
    _imagePickerModule = mod;
    return _imagePickerModule;
  } catch (err) {
    console.warn("[ImagePickerService] expo-image-picker native module not available in this runtime:", err);
    _imagePickerModule = null;
    return null;
  }
}

export function isImagePickerAvailable(): boolean {
  return getImagePicker() !== null;
}

export async function capturePhotoAsync(): Promise<PhotoAsset | null> {
  const picker = getImagePicker();
  if (!picker) {
    Alert.alert(
      "Camera Not Available",
      "Camera native module is not available in the current client build. If running in Expo, restart Metro with cache cleared (npx expo start -c) or build a development client."
    );
    return null;
  }

  try {
    const { status } = await picker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Needed", "Camera access is required to take photos.");
      return null;
    }

    const result = await picker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      return {
        uri: asset.uri,
        name: asset.fileName || `photo_${Date.now()}.jpg`,
        type: asset.mimeType || "image/jpeg",
      };
    }
  } catch (err: any) {
    console.error("[ImagePickerService] Error capturing photo:", err);
    Alert.alert("Camera Error", err?.message || "Could not launch camera.");
  }
  return null;
}

export async function pickImagesFromLibraryAsync(allowsMultiple: boolean = true): Promise<PhotoAsset[]> {
  const picker = getImagePicker();
  if (!picker) {
    Alert.alert(
      "Gallery Not Available",
      "Photo library native module is not available in the current client build. If running in Expo, restart Metro with cache cleared (npx expo start -c)."
    );
    return [];
  }

  try {
    const result = await picker.launchImageLibraryAsync({
      quality: 0.8,
      allowsMultipleSelection: allowsMultiple,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      return result.assets.map((asset: any) => ({
        uri: asset.uri,
        name: asset.fileName || `image_${Date.now()}.jpg`,
        type: asset.mimeType || "image/jpeg",
      }));
    }
  } catch (err: any) {
    console.error("[ImagePickerService] Error picking from library:", err);
    Alert.alert("Gallery Error", err?.message || "Could not open photo library.");
  }
  return [];
}

