import React, {useRef, useState} from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  LayoutChangeEvent,
  GestureResponderEvent,
} from 'react-native';

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  trackColor?: string;
  fillColor?: string;
  onChange: (value: number) => void;
}

/**
 * Lightweight pure-JS slider (no native dependency). Drag or tap anywhere on
 * the track to set a value, snapped to `step` and clamped to [min, max].
 */
export const Slider: React.FC<SliderProps> = ({
  value,
  min,
  max,
  step = 1,
  trackColor = '#E5E5EA',
  fillColor = '#007AFF',
  onChange,
}) => {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);

  const snap = (v: number): number => {
    const clamped = Math.min(max, Math.max(min, v));
    const snapped = Math.round((clamped - min) / step) * step + min;
    return parseFloat(snapped.toFixed(6));
  };

  const setFromX = (x: number) => {
    const w = widthRef.current;
    if (w <= 0) {
      return;
    }
    const ratio = Math.min(1, Math.max(0, x / w));
    onChange(snap(min + ratio * (max - min)));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) =>
        setFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e: GestureResponderEvent) =>
        setFromX(e.nativeEvent.locationX),
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    setWidth(w);
  };

  const ratio = max > min ? (Math.min(max, Math.max(min, value)) - min) / (max - min) : 0;
  const thumbLeft = width > 0 ? ratio * width : 0;

  return (
    <View style={styles.hitArea} onLayout={onLayout} {...pan.panHandlers}>
      <View style={[styles.track, {backgroundColor: trackColor}]}>
        <View
          pointerEvents="none"
          style={[styles.fill, {backgroundColor: fillColor, width: thumbLeft}]}
        />
      </View>
      <View
        pointerEvents="none"
        style={[styles.thumb, {left: thumbLeft - THUMB / 2}]}
      />
    </View>
  );
};

const THUMB = 22;

const styles = StyleSheet.create({
  hitArea: {
    height: 36,
    justifyContent: 'center',
  },
  track: {
    height: 4,
    borderRadius: 2,
  },
  fill: {
    height: 4,
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C7C7CC',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
});
