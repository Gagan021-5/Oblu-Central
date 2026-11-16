import { Dimensions, PixelRatio, useWindowDimensions } from "react-native";

// Standard mobile baseline: 375dp width, 812dp height (standard modern smartphone viewport)
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

/**
 * Linear horizontal scale based on window width
 */
export const scale = (size: number): number => {
  const { width } = Dimensions.get("window");
  return Math.round((width / BASE_WIDTH) * size);
};

/**
 * Linear vertical scale based on window height
 */
export const verticalScale = (size: number): number => {
  const { height } = Dimensions.get("window");
  return Math.round((height / BASE_HEIGHT) * size);
};

/**
 * Moderate scale with dampening factor (0.5 default)
 * Prevents elements from shrinking too small on 320/360dp or blowing up too large on tablets.
 */
export const moderateScale = (size: number, factor = 0.5): number => {
  const { width } = Dimensions.get("window");
  const scaled = (width / BASE_WIDTH) * size;
  return Math.round(size + (scaled - size) * factor);
};

/**
 * Safe Font Scale: scales font size with moderate scaling and caps it
 * to avoid excessive text growth on Android devices with custom font scale.
 */
export const responsiveFontSize = (size: number): number => {
  const { width } = Dimensions.get("window");
  const scaleRatio = width / BASE_WIDTH;
  const newSize = size * (1 + (scaleRatio - 1) * 0.4);
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

/**
 * Reactive responsive dimensions hook
 */
export const useResponsive = () => {
  const { width, height } = useWindowDimensions();

  const isSmallDevice = width < 375;
  const isMediumDevice = width >= 375 && width < 420;
  const isLargeDevice = width >= 420;

  const rScale = (size: number) => Math.round((width / BASE_WIDTH) * size);
  const rVerticalScale = (size: number) => Math.round((height / BASE_HEIGHT) * size);
  const rModerateScale = (size: number, factor = 0.5) =>
    Math.round(size + ((width / BASE_WIDTH) * size - size) * factor);

  return {
    width,
    height,
    isSmallDevice,
    isMediumDevice,
    isLargeDevice,
    scale: rScale,
    verticalScale: rVerticalScale,
    moderateScale: rModerateScale,
  };
};
