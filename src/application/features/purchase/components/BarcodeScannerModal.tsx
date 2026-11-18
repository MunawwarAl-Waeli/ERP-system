import React from "react";
import { StyleSheet, View, Modal, Text } from "react-native";
import { Camera, CameraType } from "react-native-camera-kit";
import { IconButton } from "react-native-paper";

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onCodeScanned: (code: string) => void;
}

export const BarcodeScannerModal = ({
  visible,
  onDismiss,
  onCodeScanned,
}: Props) => {
  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.container}>
        <Camera
          style={StyleSheet.absoluteFill}
          cameraType={CameraType.Back}
          scanBarcode={true}
          onReadCode={(event) => {
            const code = event.nativeEvent.codeStringValue;
            if (code) {
              onCodeScanned(code);
            }
          }}
          showFrame={true}
          laserColor="red"
          frameColor="white"
        />

        <View style={styles.overlay} pointerEvents="box-none">
          <IconButton
            icon="close"
            iconColor="#fff"
            size={30}
            onPress={onDismiss}
            style={styles.closeButton}
          />
          <View style={styles.hintContainer}>
            <Text style={styles.hintText}>وجه الكاميرا نحو الباركود</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  closeButton: {
    position: "absolute",
    top: 40,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  hintContainer: {
    position: "absolute",
    bottom: 50,
    width: "100%",
    alignItems: "center",
  },
  hintText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 10,
    borderRadius: 8,
  },
});
